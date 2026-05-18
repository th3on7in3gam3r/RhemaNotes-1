import localforage from 'localforage';
import { SermonHistoryItem, SermonSummaryOutput, UserNote } from '../types';

const STORAGE_KEY = 'spiritscribe_history';
const API_BASE = '/api/sermons';

// Configure localforage to use IndexedDB primarily
localforage.config({
  name: 'SpiritScribe',
  storeName: 'sermons',
  description: 'Stores generated sermon histories and transcripts'
});

export const saveSermonToHistory = async (summary: SermonSummaryOutput, userId: string = 'guest'): Promise<SermonHistoryItem> => {
  const newItem: SermonHistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    summary,
    user_id: userId,
  };

  // 1. Save locally first (Instant feedback & Offline support)
  const history = await getSermonHistory(userId);
  const updatedHistory = [newItem, ...history];
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Attempt to sync to Cloudflare D1
  try {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newItem.id,
        user_id: userId,
        title: summary.title,
        main_topic: summary.main_topic,
        clean_transcript: summary.clean_transcript,
        source_type: 'text', // Logic to determine type can be added here
        summary_json: JSON.stringify(summary)
      })
    });
  } catch (e) {
    console.warn('D1 Sync failed, item remains in local storage.', e);
  }
  
  return newItem;
};

export const getSermonHistory = async (userId: string = 'guest'): Promise<SermonHistoryItem[]> => {
  // 1. Load current local cache first to prevent any data loss
  const localHistory = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY) || [];
  const localMap = new Map(localHistory.map(item => [item.id, item]));

  try {
    // 2. Fetch from cloud with userId parameter to enforce creator isolation and bust cache
    const response = await fetch(`${API_BASE}?userId=${userId}&t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (response.ok) {
      const cloudSermons: any[] = await response.json();
      
      // Map D1 rows back to SermonHistoryItem format
      const formatted: SermonHistoryItem[] = cloudSermons.map(s => {
        // If we already have this sermon cached locally with detailed insights, preserve them!
        if (localMap.has(s.id)) {
          const localItem = localMap.get(s.id)!;
          
          let parsedCloudSummary: SermonSummaryOutput | null = null;
          if (s.summary_json) {
            try {
              parsedCloudSummary = JSON.parse(s.summary_json);
            } catch {}
          }

          const localScripturesCount = localItem.summary.scriptures?.length ?? 0;
          const cloudScripturesCount = parsedCloudSummary?.scriptures?.length ?? 0;

          // If the D1 cloud database contains scriptures while local cache has 0, auto-heal and restore!
          const mergedSummary = (cloudScripturesCount > localScripturesCount && parsedCloudSummary)
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
              clean_transcript: s.clean_transcript || mergedSummary.clean_transcript
            }
          };
        }

        // If we don't have it locally, attempt to parse the full summary_json from D1
        let parsedSummary: SermonSummaryOutput;
        if (s.summary_json) {
          try {
            parsedSummary = JSON.parse(s.summary_json);
          } catch {
            parsedSummary = {
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
          }
        } else {
          parsedSummary = {
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
        }

        return {
          id: s.id,
          timestamp: new Date(s.created_at).getTime(),
          user_id: s.user_id,
          summary: parsedSummary
        };
      });

      // 3. Update local cache with merged list
      // Preserve local items that are not yet in the cloud (offline creations or delayed syncs)
      const cloudIds = new Set(cloudSermons.map(s => s.id));
      const localOnly = localHistory.filter(item => !cloudIds.has(item.id) && (!item.user_id || item.user_id === userId));
      
      const merged = [...formatted, ...localOnly].sort((a, b) => b.timestamp - a.timestamp);

      if (merged.length > 0) {
        await localforage.setItem(STORAGE_KEY, merged);
        return merged;
      }
    }
  } catch (e) {
    console.warn('D1 fetch failed, falling back to local storage.', e);
  }

  // 4. Fallback to local storage (filtering by user locally if loaded without internet)
  return localHistory.filter(item => !item.user_id || item.user_id === userId);
};

export const deleteSermonFromHistory = async (id: string, userId: string = 'guest'): Promise<void> => {
  // 1. Remove locally
  const history = await getSermonHistory(userId);
  const updatedHistory = history.filter(item => item.id !== id);
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Remove from cloud with creator security header and query string
  try {
    await fetch(`${API_BASE}/${id}?userId=${userId}`, { 
      method: 'DELETE',
      headers: { 'X-User-Id': userId }
    });
  } catch (e) {
    console.warn('D1 Delete failed, sync will happen later.', e);
  }
};

export const updateSermonInHistory = async (id: string, summary: SermonSummaryOutput, userId: string = 'guest'): Promise<void> => {
  // 1. Update locally
  const history = await getSermonHistory(userId);
  const updatedHistory = history.map(item => 
    item.id === id ? { ...item, summary } : item
  );
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Update in cloud with creator security header and query string
  try {
    await fetch(`${API_BASE}/${id}?userId=${userId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Id': userId 
      },
      body: JSON.stringify({
        title: summary.title,
        main_topic: summary.main_topic,
        clean_transcript: summary.clean_transcript,
        summary_json: JSON.stringify(summary)
      })
    });
  } catch (e) {
    console.warn('D1 Update failed.', e);
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
