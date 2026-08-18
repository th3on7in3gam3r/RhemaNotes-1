/**
 * bibleService.ts
 *
 * Fetches Bible verse text from the free bible-api.com endpoint.
 * Supports multiple translations via the `translation` query param.
 *
 * API docs: https://bible-api.com/
 * Supported translations: kjv, web, bbe, oeb-us, almeida, rccv
 */

import { BibleVerseData, BibleTranslation, ParsedVerseRef } from '../types';
import { normalizeBibleReference } from '../lib/bibleReference';

// ── Supported translations ────────────────────────────────────────────────────

export const BIBLE_TRANSLATIONS: BibleTranslation[] = [
  { id: 'kjv',    label: 'King James Version',          abbreviation: 'KJV'  },
  { id: 'web',    label: 'World English Bible',          abbreviation: 'WEB'  },
  { id: 'bbe',    label: 'Bible in Basic English',       abbreviation: 'BBE'  },
  { id: 'oeb-us', label: 'Open English Bible (US)',      abbreviation: 'OEB'  },
  { id: 'almeida',label: 'João Ferreira de Almeida (PT)',abbreviation: 'ALM'  },
];

export const DEFAULT_TRANSLATION = 'kjv';

export { normalizeBibleReference } from '../lib/bibleReference';

// ── Verse fetching ────────────────────────────────────────────────────────────

const cache = new Map<string, BibleVerseData>();

export async function fetchVerse(
  reference: string,
  translation: string = DEFAULT_TRANSLATION,
): Promise<BibleVerseData> {
  const cleaned = normalizeBibleReference(reference);
  const key = `${translation}::${cleaned}`;
  if (cache.has(key)) return cache.get(key)!;

  const params = new URLSearchParams({
    reference: cleaned,
    translation,
  });
  const res = await fetch(`/api/bible/verse?${params.toString()}`);
  if (!res.ok) {
    let message = `Bible API error ${res.status} for "${cleaned}" (${translation})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const data = (await res.json()) as BibleVerseData;
  const result: BibleVerseData = {
    reference: data.reference ?? cleaned,
    text: (data.text ?? '').trim(),
    translation: (data.translation ?? translation).toUpperCase(),
  };

  cache.set(key, result);
  return result;
}

// ── Reference detection ───────────────────────────────────────────────────────

/**
 * Regex that matches standard Bible references such as:
 *   John 3:16
 *   1 Corinthians 13:4-7
 *   Genesis 1:1
 *   Psalm 23
 *   Romans 8:28-30
 */
const VERSE_REGEX =
  /\b((?:\d\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?\b/g;

export function detectVerseReferences(text: string): ParsedVerseRef[] {
  const refs: ParsedVerseRef[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex before each use
  VERSE_REGEX.lastIndex = 0;

  while ((match = VERSE_REGEX.exec(text)) !== null) {
    const [raw, book, chapter, verseStart, verseEnd] = match;
    if (!isKnownBook(book)) continue;
    refs.push({
      book,
      chapter: parseInt(chapter, 10),
      verseStart: verseStart ? parseInt(verseStart, 10) : 1,
      verseEnd: verseEnd ? parseInt(verseEnd, 10) : undefined,
      raw,
    });
  }

  return refs;
}

/**
 * Replaces verse references in a string with clickable <span> elements.
 * Returns an array of React-renderable segments: plain strings or ref objects.
 */
export function splitTextWithRefs(
  text: string,
): Array<{ type: 'text'; value: string } | { type: 'ref'; value: string }> {
  const segments: Array<{ type: 'text'; value: string } | { type: 'ref'; value: string }> = [];
  let lastIndex = 0;

  VERSE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = VERSE_REGEX.exec(text)) !== null) {
    const [raw, book] = match;
    if (!isKnownBook(book)) continue;

    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'ref', value: raw });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

// ── Known Bible books (for validation) ───────────────────────────────────────

const KNOWN_BOOKS = new Set([
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalm','Psalms','Proverbs','Ecclesiastes',
  'Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea',
  'Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai',
  'Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
]);

function isKnownBook(name: string): boolean {
  return KNOWN_BOOKS.has(name);
}
