import { normalizeBibleReference } from '../lib/bibleReference';

export interface BibleVerseResult {
  reference: string;
  text: string;
  translation: string;
  source: 'bible-api.com' | 'api.bible';
}

const BIBLE_API_COM = 'https://bible-api.com';

/** api.bible Bible IDs (public / standard licenses) */
const API_BIBLE_IDS: Record<string, string> = {
  kjv: 'de4e12af7f28f599-01',
  web: '9879dbb7cfe39e4d-01',
  bbe: '685d147df8997af4-01',
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchFromBibleApiCom(
  reference: string,
  translation: string,
): Promise<BibleVerseResult | null> {
  const url = `${BIBLE_API_COM}/${encodeURIComponent(reference)}?translation=${encodeURIComponent(translation)}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as { reference?: string; text?: string };
  const text = (data.text ?? '').trim();
  if (!text) return null;

  return {
    reference: data.reference ?? reference,
    text,
    translation: translation.toUpperCase(),
    source: 'bible-api.com',
  };
}

async function fetchFromApiBible(
  apiKey: string,
  reference: string,
  translation: string,
): Promise<BibleVerseResult | null> {
  const bibleId = API_BIBLE_IDS[translation] ?? API_BIBLE_IDS.kjv;
  const searchUrl = new URL(`https://api.scripture.api.bible/v1/bibles/${bibleId}/search`);
  searchUrl.searchParams.set('query', reference);
  searchUrl.searchParams.set('limit', '5');

  const res = await fetch(searchUrl.toString(), {
    headers: { 'api-key': apiKey },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: {
      verses?: { reference?: string; text?: string; content?: string }[];
      passages?: { reference?: string; content?: string }[];
    };
  };

  const verse = data.data?.verses?.[0];
  if (verse) {
    const text = stripHtml(verse.text || verse.content || '');
    if (text) {
      return {
        reference: verse.reference ?? reference,
        text,
        translation: translation.toUpperCase(),
        source: 'api.bible',
      };
    }
  }

  const passage = data.data?.passages?.[0];
  if (passage?.content) {
    const text = stripHtml(passage.content);
    if (text) {
      return {
        reference: passage.reference ?? reference,
        text,
        translation: translation.toUpperCase(),
        source: 'api.bible',
      };
    }
  }

  return null;
}

export async function resolveBibleVerse(
  rawReference: string,
  translation: string,
  apiBibleKey?: string,
): Promise<BibleVerseResult> {
  const reference = normalizeBibleReference(rawReference);
  if (!reference) {
    throw new Error(`Invalid scripture reference: "${rawReference}"`);
  }

  const fromFree = await fetchFromBibleApiCom(reference, translation);
  if (fromFree) return fromFree;

  if (apiBibleKey) {
    const fromApiBible = await fetchFromApiBible(apiBibleKey, reference, translation);
    if (fromApiBible) return fromApiBible;
  }

  throw new Error(
    apiBibleKey
      ? `Could not find "${reference}" (${translation}). Try another translation or check the reference.`
      : `Could not find "${reference}" (${translation}). Set BIBLE_API_KEY on the Worker for api.bible fallback.`,
  );
}
