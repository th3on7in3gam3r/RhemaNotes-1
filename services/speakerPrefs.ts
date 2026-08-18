import type { SermonSpeakerInput } from '../lib/speakerMeta';

const KEY = 'rhemanotes_speaker_prefs';

export function loadSpeakerPrefs(): SermonSpeakerInput {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { preacherName: '', speakerTitle: '' };
    const parsed = JSON.parse(raw) as Partial<SermonSpeakerInput>;
    return {
      preacherName: parsed.preacherName ?? '',
      speakerTitle: parsed.speakerTitle ?? '',
    };
  } catch {
    return { preacherName: '', speakerTitle: '' };
  }
}

export function saveSpeakerPrefs(input: SermonSpeakerInput): void {
  if (!input.preacherName.trim() && !input.speakerTitle.trim()) return;
  localStorage.setItem(
    KEY,
    JSON.stringify({
      preacherName: input.preacherName.trim(),
      speakerTitle: input.speakerTitle.trim(),
    }),
  );
}
