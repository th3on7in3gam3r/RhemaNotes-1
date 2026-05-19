import localforage from 'localforage';
import { SermonHistoryItem, SermonSummaryOutput, UserNote } from '../types';

const STORAGE_KEY = 'spiritscribe_history';
const PENDING_SYNC_KEY = 'spiritscribe_pending_sync';
const API_BASE = '/api/sermons';

// Configure localforage to use IndexedDB primarily
localforage.config({
  name: 'SpiritScribe',
  storeName: 'sermons',
  description: 'Stores generated sermon histories and transcripts'
});

// ── Pending sync queue ────────────────────────────────────────────────────────
// Items that failed to POST to D1 are queued here and retried on next load.

interface PendingSyncItem {
  id: string;
  userId: string;
  payload: object;
}

const getPendingSyncQueue = async (): Promise<PendingSyncItem[]> => {
  return (await localforage.getItem<PendingSyncItem[]>(PENDING_SYNC_KEY)) || [];
};

const addToPendingSyncQueue = async (item: PendingSyncItem): Promise<void> => {
  const queue = await getPendingSyncQueue();
  // Avoid duplicates — replace if already queued
  const filtered = queue.filter(q => q.id !== item.id);
  await localforage.setItem(PENDING_SYNC_KEY, [...filtered, item]);
};

const removeFromPendingSyncQueue = async (id: string): Promise<void> => {
  const queue = await getPendingSyncQueue();
  await localforage.setItem(PENDING_SYNC_KEY, queue.filter(q => q.id !== id));
};

/**
 * Retry any items that failed to POST to D1 on a previous session.
 * Called at the start of getSermonHistory so it runs automatically on every load.
 */
const flushPendingSyncQueue = async (): Promise<void> => {
  const queue = await getPendingSyncQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (res.ok || res.status === 409) {
        // 409 = already exists (duplicate), safe to remove from queue
        await removeFromPendingSyncQueue(item.id);
      }
    } catch {
      // Still offline — leave in queue for next attempt
    }
  }
};

// ── Save ──────────────────────────────────────────────────────────────────────

/**
 * Strip fields that must not be serialized to D1:
 *   - audio_blob: a Blob — JSON.stringify produces "{}", losing all data
 *   - chat_history: can be very large, not needed for restore
 * Both are session-only and cannot survive a page reload anyway.
 */
const stripNonSerializable = (summary: SermonSummaryOutput): SermonSummaryOutput => {
  const { audio_blob, chat_history, ...rest } = summary as any;
  return rest as SermonSummaryOutput;
};

export const saveSermonToHistory = async (
  summary: SermonSummaryOutput,
  userId: string = 'guest'
): Promise<SermonHistoryItem> => {
  const newItem: SermonHistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    summary,
    user_id: userId,
  };

  // 1. Save locally first (instant feedback & offline support)
  const history = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY) || [];
  await localforage.setItem(STORAGE_KEY, [newItem, ...history]);

  // 2. Attempt to sync to Cloudflare D1
  const serializable = stripNonSerializable(summary);
  const d1Payload = {
    id: newItem.id,
    user_id: userId,
    title: serializable.title,
    main_topic: serializable.main_topic,
    clean_transcript: serializable.clean_transcript,
    source_type: 'text',
    summary_json: JSON.stringify(serializable),
  };

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d1Payload),
    });

    if (!res.ok) {
      // D1 rejected the write — queue for retry
      console.warn(`D1 POST failed (${res.status}), queuing for retry.`);
      await addToPendingSyncQueue({ id: newItem.id, userId, payload: d1Payload });
    }
  } catch (e) {
    // Network error — queue for retry
    console.warn('D1 POST network error, queuing for retry.', e);
    await addToPendingSyncQueue({ id: newItem.id, userId, payload: d1Payload });
  }

  return newItem;
};

// ── Load ──────────────────────────────────────────────────────────────────────

export const getSermonHistory = async (userId: string = 'guest'): Promise<SermonHistoryItem[]> => {
  // Retry any previously failed POSTs before fetching
  await flushPendingSyncQueue();

  // 1. Load current local cache first to prevent any data loss
  const localHistory = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY) || [];
  const localMap = new Map(localHistory.map(item => [item.id, item]));

  try {
    // 2. Fetch from cloud with userId parameter to enforce creator isolation and bust cache
    const response = await fetch(`${API_BASE}?userId=${userId}&t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });

    if (response.ok) {
      const cloudSermons: any[] = await response.json();

      // Map D1 rows back to SermonHistoryItem format
      const formatted: SermonHistoryItem[] = cloudSermons.map(s => {
        // Parse cloud summary_json once, used in both branches below
        let parsedCloudSummary: SermonSummaryOutput | null = null;
        if (s.summary_json) {
          try {
            parsedCloudSummary = JSON.parse(s.summary_json);
          } catch {}
        }

        if (localMap.has(s.id)) {
          const localItem = localMap.get(s.id)!;

          const localScripturesCount = localItem.summary.scriptures?.length ?? 0;
          const cloudScripturesCount = parsedCloudSummary?.scriptures?.length ?? 0;

          // Prefer whichever source has more scriptures.
          // If local is empty (e.g. after a hard refresh cleared IndexedDB) and
          // cloud has the full data, restore from cloud automatically.
          const mergedSummary =
            cloudScripturesCount > localScripturesCount && parsedCloudSummary
              ? parsedCloudSummary
              : localItem.summary;

          return {
            ...localItem,
            timestamp: new Date(s.created_at).getTime(),
            user_id: s.user_id,
            summary: {
              ...mergedSummary,
              title: s.title || mergedSummary.title,
              main_topic: s.main_topic || mergedSummary.main_topic,
              clean_transcript: s.clean_transcript || mergedSummary.clean_transcript,
              // Always preserve the local liked state — it's the most up-to-date
              // source since a PATCH may still be in-flight or have failed.
              // If local has never set liked, fall back to whatever cloud has.
              liked: localItem.summary.liked ?? parsedCloudSummary?.liked ?? false,
            },
          };
        }

        // Not in local cache — use cloud summary_json if available.
        // Fall back to a minimal object only when summary_json is truly absent.
        const parsedSummary: SermonSummaryOutput = parsedCloudSummary ?? {
          title: s.title,
          main_topic: s.main_topic,
          clean_transcript: s.clean_transcript,
          scriptures: [],
          key_points: [],
          quotes: [],
          applications: [],
          open_questions: [],
          actionable_insights: [],
        };

        return {
          id: s.id,
          timestamp: new Date(s.created_at).getTime(),
          user_id: s.user_id,
          summary: parsedSummary,
        };
      });

      // 3. Preserve local-only items (offline creations / delayed syncs)
      const cloudIds = new Set(cloudSermons.map(s => s.id));
      const localOnly = localHistory.filter(
        item => !cloudIds.has(item.id) && (!item.user_id || item.user_id === userId)
      );

      const merged = [...formatted, ...localOnly].sort((a, b) => b.timestamp - a.timestamp);

      if (merged.length > 0) {
        await localforage.setItem(STORAGE_KEY, merged);
        return merged;
      }
    }
  } catch (e) {
    console.warn('D1 fetch failed, falling back to local storage.', e);
  }

  // 4. Fallback to local storage
  return localHistory.filter(item => !item.user_id || item.user_id === userId);
};

// ── Delete ────────────────────────────────────────────────────────────────────

export const deleteSermonFromHistory = async (id: string, userId: string = 'guest'): Promise<void> => {
  // 1. Remove locally
  const history = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY) || [];
  await localforage.setItem(STORAGE_KEY, history.filter(item => item.id !== id));

  // 2. Remove from cloud
  try {
    await fetch(`${API_BASE}/${id}?userId=${userId}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    });
  } catch (e) {
    console.warn('D1 Delete failed, sync will happen later.', e);
  }
};

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Updates a sermon in both local storage and D1.
 * Returns `true` if the D1 PATCH succeeded, `false` if it failed (local update
 * always happens regardless so the UI stays consistent).
 */
export const updateSermonInHistory = async (
  id: string,
  summary: SermonSummaryOutput,
  userId: string = 'guest'
): Promise<boolean> => {
  // 1. Update locally — always succeeds, keeps UI in sync
  const history = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY) || [];
  const updatedHistory = history.map(item =>
    item.id === id ? { ...item, summary } : item
  );
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Update in cloud
  const serializable = stripNonSerializable(summary);
  try {
    const res = await fetch(`${API_BASE}/${id}?userId=${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        title: serializable.title,
        main_topic: serializable.main_topic,
        clean_transcript: serializable.clean_transcript,
        summary_json: JSON.stringify(serializable),
      }),
    });

    if (!res.ok) {
      console.warn(`D1 PATCH failed (${res.status}) for sermon ${id}.`);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('D1 PATCH network error.', e);
    return false;
  }
};

// ── Live Drafts (Local Only) ──────────────────────────────────────────────────

const DRAFT_KEY = 'spiritscribe_live_draft';

export const saveLiveDraft = async (notes: UserNote[]): Promise<void> => {
  await localforage.setItem(DRAFT_KEY, notes);
};
export const getLiveDraft = async (): Promise<UserNote[]> => {
  const stored = await localforage.getItem<UserNote[]>(DRAFT_KEY);
  return stored || [];
};
export const clearLiveDraft = async (): Promise<void> => {
  await localforage.removeItem(DRAFT_KEY);
};
export const clearHistory = async (): Promise<void> => {
  await localforage.removeItem(STORAGE_KEY);
};
