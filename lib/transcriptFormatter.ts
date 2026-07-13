export interface TranscriptMetadata {
  sermonTitle: string | null;
  bibleReference: string | null;
  cleanedTranscript: string;
}

/** Build the final markdown transcript document. */
export function formatSermonTranscript(meta: TranscriptMetadata): string {
  const title = meta.sermonTitle?.trim() || 'Sermon Transcript';
  const scripture = meta.bibleReference?.trim() || 'Not detected';
  const body = meta.cleanedTranscript.trim();

  return `# ${title}\n**Scripture: ${scripture}**\n---\n${body}`;
}
