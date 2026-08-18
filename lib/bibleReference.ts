/**
 * Clean sermon-detected references before Bible API lookup.
 * e.g. "Jeremiah 33:3 (implied)" → "Jeremiah 33:3"
 */
export function normalizeBibleReference(reference: string): string {
  return reference
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/^(?:cf\.?|see)\s+/i, '')
    .replace(/[,;.]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
