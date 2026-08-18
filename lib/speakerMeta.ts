export const SPEAKER_TITLE_OPTIONS = [
  '',
  'Pastor',
  'Rev.',
  'Bishop',
  'Dr.',
  'Evangelist',
  'Elder',
  'Minister',
  'Guest Speaker',
  'Teacher',
  'Other',
] as const;

export interface SermonSpeakerInput {
  preacherName: string;
  speakerTitle: string;
}

export interface SermonSpeakerMeta {
  preacher_name?: string;
  speaker_title?: string;
}

export function speakerInputToMeta(input: SermonSpeakerInput): SermonSpeakerMeta | undefined {
  const preacher_name = input.preacherName.trim();
  const speaker_title = input.speakerTitle.trim();
  if (!preacher_name && !speaker_title) return undefined;
  return {
    preacher_name: preacher_name || undefined,
    speaker_title: speaker_title || undefined,
  };
}

export function metaToSpeakerInput(meta?: SermonSpeakerMeta): SermonSpeakerInput {
  return {
    preacherName: meta?.preacher_name ?? '',
    speakerTitle: meta?.speaker_title ?? '',
  };
}

export function formatSpeakerLabel(meta?: SermonSpeakerMeta | null): string | null {
  if (!meta) return null;
  const name = meta.preacher_name?.trim();
  const title = meta.speaker_title?.trim();
  if (name && title) return `${title} ${name}`;
  return name || title || null;
}

export function applySpeakerMeta<T extends SermonSpeakerMeta>(
  summary: T,
  meta?: SermonSpeakerMeta,
): T {
  if (!meta) return summary;
  if (meta.preacher_name) summary.preacher_name = meta.preacher_name;
  if (meta.speaker_title) summary.speaker_title = meta.speaker_title;
  return summary;
}
