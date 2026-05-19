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

// ── Liked state (localStorage) ───────────────────────────────────────────────
// Stored separately from D1/IndexedDB so it survives hard refreshes and is
// never affected by service worker caching or D1 PATCH failures.

const LIKED_KEY = 'spiritscribe_liked';

const getLikedMap = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(LIKED_KEY) || '{}');
  } catch {
    return {};
  }
};

export const setSermonLiked = (id: string, liked: boolean): void => {
  const map = getLikedMap();
  if (liked) {
    map[id] = true;
  } else {
    delete map[id];
  }
  localStorage.setItem(LIKED_KEY, JSON.stringify(map));
};

export const getSermonLiked = (id: string): boolean => {
  return getLikedMap()[id] === true;
};

// ── Guest → User claim ───────────────────────────────────────────────────────

/**
 * When a user signs in, any sermons that were created as 'guest' in this
 * browser session should be claimed under their real user ID.
 *
 * Steps:
 *   1. Find all local items with user_id === 'guest'
 *   2. Re-POST them to D1 with the real user_id (worker allows this)
 *   3. Update localforage so they carry the real user_id going forward
 *
 * Called from App.tsx whenever the Clerk user transitions from null → real user.
 */
export const claimGuestSermons = async (realUserId: string): Promise<void> => {
  if (!realUserId || realUserId === 'guest') return;

  const history = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY) || [];
  const guestItems = history.filter(item => !item.user_id || item.user_id === 'guest');
  if (guestItems.length === 0) return;

  // Re-POST each guest sermon under the real user_id.
  // The worker's INSERT will fail with a duplicate-key error if the row already
  // exists — that's fine, we just ignore it and still update localforage.
  for (const item of guestItems) {
    const serializable = stripNonSerializable(item.summary);
    try {
      await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          user_id: realUserId,
          title: serializable.title,
          main_topic: serializable.main_topic,
          clean_transcript: serializable.clean_transcript,
          source_type: 'text',
          summary_json: JSON.stringify(serializable),
        }),
      });
    } catch {
      // Network error — the PATCH guest-claim in the worker will handle it
      // next time the user loads their history
    }
  }

  // Update localforage: stamp all guest items with the real user_id
  const updated = history.map(item =>
    (!item.user_id || item.user_id === 'guest')
      ? { ...item, user_id: realUserId }
      : item
  );
  await localforage.setItem(STORAGE_KEY, updated);
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
  // Load the reliable localStorage liked map
  const likedMap = getLikedMap();

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
              // localStorage is the source of truth for liked — it's synchronous,
              // survives hard refreshes, and is never touched by the service worker.
              liked: likedMap[s.id] ?? localItem.summary.liked ?? parsedCloudSummary?.liked ?? false,
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
          summary: {
            ...parsedSummary,
            liked: likedMap[s.id] ?? parsedSummary.liked ?? false,
          },
        };
      });

      // 3. Preserve local-only items (offline creations / delayed syncs).
      // Also include any items still tagged as 'guest' in localforage — these
      // are sermons created before sign-in that haven't been claimed yet.
      // They stay visible until claimGuestSermons() re-tags them.
      const cloudIds = new Set(cloudSermons.map(s => s.id));
      const localOnly = localHistory.filter(item => {
        if (cloudIds.has(item.id)) return false; // already in cloud result
        const isOwned = !item.user_id || item.user_id === userId;
        const isUnclaimed = item.user_id === 'guest';
        return isOwned || isUnclaimed;
      });

      const merged = [...formatted, ...localOnly].sort((a, b) => b.timestamp - a.timestamp);

      if (merged.length > 0) {
        await localforage.setItem(STORAGE_KEY, merged);
        return merged;
      }
    }
  } catch (e) {
    console.warn('D1 fetch failed, falling back to local storage.', e);
  }

  // 4. Fallback to local storage — include guest items so they're never lost
  return localHistory.filter(
    item => !item.user_id || item.user_id === userId || item.user_id === 'guest'
  );
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
