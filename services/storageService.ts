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

/**
 * Saves a sermon to both local storage (IndexedDB) and the D1 cloud database.
 */
export const saveSermonToHistory = async (summary: SermonSummaryOutput): Promise<SermonHistoryItem> => {
  const newItem: SermonHistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    summary,
  };

  // 1. Save locally first (Instant feedback & Offline support)
  const history = await getSermonHistory();
  const updatedHistory = [newItem, ...history];
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Attempt to sync to Cloudflare D1
  try {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newItem.id,
        user_id: 'guest', // Replace with real auth user ID when available
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

export const getSermonHistory = async (): Promise<SermonHistoryItem[]> => {
  // 1. Load current local cache first to prevent any data loss
  const localHistory = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY) || [];
  const localMap = new Map(localHistory.map(item => [item.id, item]));

  try {
    // 2. Fetch from cloud
    const response = await fetch(API_BASE);
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
          summary: parsedSummary
        };
      });

      // 3. Update local cache with merged list
      if (formatted.length > 0) {
        await localforage.setItem(STORAGE_KEY, formatted);
        return formatted;
      }
    }
  } catch (e) {
    console.warn('D1 fetch failed, falling back to local storage.', e);
  }

  // 4. Fallback to local storage
  return localHistory;
};

export const deleteSermonFromHistory = async (id: string): Promise<void> => {
  // 1. Remove locally
  const history = await getSermonHistory();
  const updatedHistory = history.filter(item => item.id !== id);
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Remove from cloud
  try {
    await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('D1 Delete failed, sync will happen later.', e);
  }
};

export const updateSermonInHistory = async (id: string, summary: SermonSummaryOutput): Promise<void> => {
  // 1. Update locally
  const history = await getSermonHistory();
  const updatedHistory = history.map(item => 
    item.id === id ? { ...item, summary } : item
  );
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Update in cloud
  try {
    await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
