import type { HeroImage, ImagePlacement, PublicSummary, Scripture, SermonSummaryOutput } from '../types';

const PLACEMENTS: ImagePlacement[] = ['top', 'left', 'right'];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asScriptures(value: unknown): Scripture[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.reference !== 'string') return [];
    return [{
      reference: row.reference,
      plain_meaning: typeof row.plain_meaning === 'string' ? row.plain_meaning : '',
      speaker_usage: typeof row.speaker_usage === 'string' ? row.speaker_usage : '',
    }];
  });
}

function sanitizeHeroImage(raw: unknown): HeroImage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const img = raw as Record<string, unknown>;
  if (typeof img.dataUrl !== 'string' || !img.dataUrl.startsWith('data:image/')) return undefined;
  const placement = PLACEMENTS.includes(img.placement as ImagePlacement)
    ? (img.placement as ImagePlacement)
    : 'top';
  return { dataUrl: img.dataUrl, placement };
}

/**
 * Strip Plan-only fields so community endpoints and confirm dialogs
 * never share prayer, reflection questions, notes, transcript, or study tools.
 */
export function toPublicSummary(summary: unknown): PublicSummary {
  const s = (summary && typeof summary === 'object')
    ? (summary as Partial<SermonSummaryOutput>)
    : {};

  const publicSummary: PublicSummary = {
    title: typeof s.title === 'string' ? s.title : '',
    main_topic: typeof s.main_topic === 'string' ? s.main_topic : '',
    scriptures: asScriptures(s.scriptures),
    key_points: asStringArray(s.key_points),
    quotes: asStringArray(s.quotes),
    applications: asStringArray(s.applications),
  };

  if (typeof s.preacher_name === 'string' && s.preacher_name) {
    publicSummary.preacher_name = s.preacher_name;
  }
  if (typeof s.speaker_title === 'string' && s.speaker_title) {
    publicSummary.speaker_title = s.speaker_title;
  }
  const hero = sanitizeHeroImage(s.hero_image);
  if (hero) publicSummary.hero_image = hero;

  return publicSummary;
}

export function parsePublicSummaryJson(json: string | null | undefined): PublicSummary {
  if (!json) return toPublicSummary({});
  try {
    return toPublicSummary(JSON.parse(json));
  } catch {
    return toPublicSummary({});
  }
}
