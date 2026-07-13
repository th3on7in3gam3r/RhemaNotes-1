import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  BookOpen, X, ChevronDown, Highlighter, MessageSquare,
  Trash2, Check, Loader2, AlertCircle, BookMarked, Search,
} from 'lucide-react';
import {
  SermonSummaryOutput,
  BibleHighlight,
  BibleAnnotation,
  BibleVerseData,
  HighlightColor,
} from '../types';
import {
  fetchVerse,
  BIBLE_TRANSLATIONS,
  DEFAULT_TRANSLATION,
  splitTextWithRefs,
  normalizeBibleReference,
} from '../services/bibleService';
import { isScriptureSaved, toggleSavedScripture } from '../services/storageService';
import { ScriptureSaveButton } from './ScriptureSaveButton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BibleTabProps {
  summary: SermonSummaryOutput;
  onUpdateSummary: (updated: SermonSummaryOutput) => void;
  /** Optional: open the tab pre-focused on a specific reference */
  initialReference?: string;
  historyId?: string;
  sermonTitle?: string;
  onScripturesChange?: () => void;
}

// ── Highlight colour palette ──────────────────────────────────────────────────

const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; bg: string; border: string; text: string }[] = [
  { id: 'yellow', label: 'Yellow',  bg: 'bg-yellow-200',  border: 'border-yellow-400', text: 'text-yellow-900' },
  { id: 'green',  label: 'Green',   bg: 'bg-green-200',   border: 'border-green-400',  text: 'text-green-900'  },
  { id: 'blue',   label: 'Blue',    bg: 'bg-blue-200',    border: 'border-blue-400',   text: 'text-blue-900'   },
  { id: 'pink',   label: 'Pink',    bg: 'bg-pink-200',    border: 'border-pink-400',   text: 'text-pink-900'   },
  { id: 'purple', label: 'Purple',  bg: 'bg-purple-200',  border: 'border-purple-400', text: 'text-purple-900' },
];

function colorClasses(color: HighlightColor) {
  return HIGHLIGHT_COLORS.find(c => c.id === color) ?? HIGHLIGHT_COLORS[0];
}

// ── Storage helpers (stored inside summary to persist with history) ───────────

function getHighlights(summary: SermonSummaryOutput): BibleHighlight[] {
  return summary.bible_highlights ?? [];
}
function getAnnotations(summary: SermonSummaryOutput): BibleAnnotation[] {
  return summary.bible_annotations ?? [];
}

// ── Verse Modal ───────────────────────────────────────────────────────────────

interface VerseModalProps {
  reference: string;
  translation: string;
  highlights: BibleHighlight[];
  annotations: BibleAnnotation[];
  onClose: () => void;
  onAddHighlight: (ref: string, color: HighlightColor) => void;
  onRemoveHighlight: (id: string) => void;
  onSaveAnnotation: (ref: string, text: string) => void;
  onRemoveAnnotation: (id: string) => void;
  onChangeTranslation: (t: string) => void;
  saveAction?: { saved: boolean; onToggle: () => void };
}

const VerseModal: React.FC<VerseModalProps> = ({
  reference,
  translation,
  highlights,
  annotations,
  onClose,
  onAddHighlight,
  onRemoveHighlight,
  onSaveAnnotation,
  onRemoveAnnotation,
  onChangeTranslation,
  saveAction,
}) => {
  const [verseData, setVerseData] = useState<BibleVerseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');

  const existingHighlight = highlights.find(
    h => h.reference === reference && h.translation === translation,
  );
  const verseAnnotations = annotations.filter(
    a => a.reference === reference,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchVerse(reference, translation)
      .then(data => { if (!cancelled) { setVerseData(data); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [reference, translation]);

  const handleSaveAnnotation = () => {
    if (!annotationText.trim()) return;
    onSaveAnnotation(reference, annotationText.trim());
    setAnnotationText('');
    setShowAnnotationInput(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-blue-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-blue-900 text-white rounded-t-3xl flex-shrink-0 gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <BookOpen className="w-6 h-6 flex-shrink-0" />
            <h2 className="text-xl font-extrabold truncate">
              {normalizeBibleReference(reference)}
              {normalizeBibleReference(reference) !== reference && (
                <span className="block text-xs font-normal text-blue-200/80 mt-0.5 truncate">
                  sermon note: {reference}
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {saveAction && (
              <ScriptureSaveButton
                saved={saveAction.saved}
                onClick={saveAction.onToggle}
                className="!border-white/30 !bg-white/10 !text-white hover:!bg-amber-100 hover:!text-amber-900"
              />
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center bg-blue-700 hover:bg-blue-600 active:bg-blue-500 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Translation selector */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center space-x-3">
          <span className="text-sm font-semibold text-blue-800">Translation:</span>
          <div className="relative">
            <select
              value={translation}
              onChange={e => onChangeTranslation(e.target.value)}
              className="appearance-none bg-white border border-blue-200 rounded-xl px-4 py-1.5 pr-8 text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              {BIBLE_TRANSLATIONS.map(t => (
                <option key={t.id} value={t.id}>{t.abbreviation} — {t.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
          </div>
        </div>

        {/* Verse text */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading && (
            <div className="flex items-center justify-center py-12 space-x-3 text-blue-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-semibold">Loading verse…</span>
            </div>
          )}
          {error && (
            <div className="flex items-center space-x-3 text-red-600 bg-red-50 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {verseData && !loading && (
            <div
              className={`rounded-2xl p-5 border-l-4 transition-colors ${
                existingHighlight
                  ? `${colorClasses(existingHighlight.color).bg} ${colorClasses(existingHighlight.color).border}`
                  : 'bg-gray-50 border-blue-200'
              }`}
            >
              <p className="text-gray-900 text-xl leading-relaxed font-serif italic">
                &ldquo;{verseData.text}&rdquo;
              </p>
              <p className="text-right text-sm text-gray-500 mt-3 font-semibold">
                — {verseData.reference} ({verseData.translation})
              </p>
            </div>
          )}

          {/* Annotations */}
          {verseAnnotations.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Your Notes</h4>
              {verseAnnotations.map(ann => (
                <div key={ann.id} className="group bg-amber-50 border border-amber-200 rounded-xl p-4 relative">
                  <p className="text-gray-800 text-sm leading-relaxed">{ann.text}</p>
                  <button
                    onClick={() => onRemoveAnnotation(ann.id)}
                    className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl space-y-4">
          {/* Highlight row */}
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <span className="text-sm font-semibold text-gray-600 flex items-center space-x-1">
              <Highlighter className="w-4 h-4" />
              <span>Highlight:</span>
            </span>
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedColor(c.id);
                  onAddHighlight(reference, c.id);
                }}
                title={c.label}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${c.bg} ${
                  existingHighlight?.color === c.id ? 'border-gray-800 scale-110' : 'border-transparent'
                }`}
              />
            ))}
            {existingHighlight && (
              <button
                onClick={() => onRemoveHighlight(existingHighlight.id)}
                className="text-xs text-red-500 hover:text-red-700 font-semibold ml-2"
              >
                Remove
              </button>
            )}
          </div>

          {/* Annotation row */}
          {showAnnotationInput ? (
            <div className="flex space-x-2">
              <textarea
                autoFocus
                value={annotationText}
                onChange={e => setAnnotationText(e.target.value)}
                placeholder="Add a note about this verse…"
                rows={2}
                className="flex-1 p-3 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
              <div className="flex flex-col space-y-1">
                <button
                  onClick={handleSaveAnnotation}
                  className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-3 py-2 text-sm font-bold transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowAnnotationInput(false); setAnnotationText(''); }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl px-3 py-2 text-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAnnotationInput(true)}
              className="flex items-center space-x-2 text-sm text-amber-700 hover:text-amber-900 font-semibold transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Add annotation</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Clickable verse reference span ────────────────────────────────────────────

interface VerseRefSpanProps {
  reference: string;
  highlights: BibleHighlight[];
  onClick: (ref: string) => void;
}

export const VerseRefSpan: React.FC<VerseRefSpanProps> = ({ reference, highlights, onClick }) => {
  const highlight = highlights.find(h => h.reference === reference);
  const cc = highlight ? colorClasses(highlight.color) : null;

  return (
    <button
      onClick={() => onClick(reference)}
      className={`inline-flex items-center space-x-1 rounded-md px-1.5 py-0.5 text-sm font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer border ${
        cc
          ? `${cc.bg} ${cc.border} ${cc.text}`
          : 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200'
      }`}
      title={`Open ${reference} in Bible reader`}
    >
      <BookOpen className="w-3 h-3" />
      <span>{reference}</span>
    </button>
  );
};

/**
 * Renders a block of text with all detected Bible references turned into
 * clickable VerseRefSpan buttons.
 */
export const TextWithVerseLinks: React.FC<{
  text: string;
  highlights: BibleHighlight[];
  onVerseClick: (ref: string) => void;
  className?: string;
}> = ({ text, highlights, onVerseClick, className }) => {
  const segments = splitTextWithRefs(text);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === 'ref' ? (
          <VerseRefSpan
            key={i}
            reference={seg.value}
            highlights={highlights}
            onClick={onVerseClick}
          />
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </span>
  );
};

// ── Main BibleTab component ───────────────────────────────────────────────────

export const BibleTab: React.FC<BibleTabProps> = ({
  summary,
  onUpdateSummary,
  initialReference,
  historyId,
  sermonTitle = 'Untitled Sermon',
  onScripturesChange,
}) => {
  const [activeReference, setActiveReference] = useState<string | null>(
    initialReference ?? null,
  );
  const [savedRefs, setSavedRefs] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (historyId) {
      summary.scriptures?.forEach(s => {
        if (isScriptureSaved(s.reference, historyId)) set.add(s.reference);
      });
    }
    return set;
  });
  const [translation, setTranslation] = useState(DEFAULT_TRANSLATION);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const highlights = getHighlights(summary);
  const annotations = getAnnotations(summary);

  // Open modal when initialReference changes from outside
  useEffect(() => {
    if (initialReference) setActiveReference(initialReference);
  }, [initialReference]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateSummaryWith = useCallback(
    (patch: Partial<{ bible_highlights: BibleHighlight[]; bible_annotations: BibleAnnotation[] }>) => {
      onUpdateSummary({ ...summary, ...patch } as SermonSummaryOutput);
    },
    [summary, onUpdateSummary],
  );

  const handleAddHighlight = useCallback(
    (reference: string, color: HighlightColor) => {
      const existing = highlights.find(
        h => h.reference === reference && h.translation === translation,
      );
      const updated = existing
        ? highlights.map(h =>
            h.id === existing.id ? { ...h, color } : h,
          )
        : [
            ...highlights,
            {
              id: crypto.randomUUID(),
              reference,
              translation,
              color,
              createdAt: Date.now(),
            },
          ];
      updateSummaryWith({ bible_highlights: updated });
    },
    [highlights, translation, updateSummaryWith],
  );

  const handleRemoveHighlight = useCallback(
    (id: string) => {
      updateSummaryWith({ bible_highlights: highlights.filter(h => h.id !== id) });
    },
    [highlights, updateSummaryWith],
  );

  const handleSaveAnnotation = useCallback(
    (reference: string, text: string) => {
      const updated: BibleAnnotation[] = [
        ...annotations,
        {
          id: crypto.randomUUID(),
          reference,
          translation,
          text,
          createdAt: Date.now(),
        },
      ];
      updateSummaryWith({ bible_annotations: updated });
    },
    [annotations, translation, updateSummaryWith],
  );

  const handleRemoveAnnotation = useCallback(
    (id: string) => {
      updateSummaryWith({ bible_annotations: annotations.filter(a => a.id !== id) });
    },
    [annotations, updateSummaryWith],
  );

  // ── Search / manual lookup ─────────────────────────────────────────────────

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      await fetchVerse(q, translation); // validate it loads
      setActiveReference(q);
      setSearchQuery('');
    } catch (err: any) {
      setSearchError(`Could not find "${q}". Try a format like "John 3:16" or "Romans 8:28".`);
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Sermon scripture references ────────────────────────────────────────────

  const sermonRefs = summary.scriptures ?? [];

  const handleSaveScripture = useCallback(
    (scripture: { reference: string; plain_meaning: string; speaker_usage: string }) => {
      if (!historyId) {
        alert('Save a sermon to your Library first, then open it again to bookmark scriptures.');
        return;
      }
      const nowSaved = toggleSavedScripture(scripture, historyId, sermonTitle);
      setSavedRefs(prev => {
        const next = new Set(prev);
        if (nowSaved) next.add(scripture.reference);
        else next.delete(scripture.reference);
        return next;
      });
      onScripturesChange?.();
    },
    [historyId, sermonTitle, onScripturesChange],
  );

  const activeSermonScripture = activeReference
    ? sermonRefs.find(s => s.reference === activeReference)
    : undefined;

  return (
    <div className="p-5 h-full overflow-y-auto bg-transparent">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <BookMarked className="w-8 h-8 text-blue-700" />
        <div>
          <h3 className="text-3xl font-extrabold text-blue-900">Bible Reader</h3>
          <p className="text-sm text-gray-500">Every reference from this sermon — tap to read, highlight &amp; annotate</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex space-x-2 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Look up any verse — e.g. John 3:16 or Psalm 23"
            className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searchLoading}
          className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center space-x-2"
        >
          {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>Look up</span>
        </button>
      </div>

      {searchError && (
        <div className="mb-4 flex items-center space-x-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Sermon references grid */}
      {sermonRefs.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
            References from this sermon ({sermonRefs.length}) — Save to your profile
          </h4>
          <div className="flex flex-wrap gap-3">
            {sermonRefs.map((s, i) => {
              const hl = highlights.find(h => h.reference === s.reference);
              const cc = hl ? colorClasses(hl.color) : null;
              const hasAnnotation = annotations.some(a => a.reference === s.reference);
              const saved = savedRefs.has(s.reference);
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveReference(s.reference)}
                    className={`group flex items-center space-x-2 px-4 py-2 rounded-full border-2 font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-sm ${
                      cc
                        ? `${cc.bg} ${cc.border} ${cc.text}`
                        : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{s.reference}</span>
                    {hasAnnotation && (
                      <MessageSquare className="w-3 h-3 opacity-70" />
                    )}
                  </button>
                  <ScriptureSaveButton
                    saved={saved}
                    onClick={() => handleSaveScripture(s)}
                    showLabel={false}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Highlights library */}
      {highlights.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
            Your Highlights ({highlights.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlights.map(hl => {
              const cc = colorClasses(hl.color);
              const ann = annotations.filter(a => a.reference === hl.reference);
              return (
                <div
                  key={hl.id}
                  className={`group relative rounded-2xl border-l-4 p-4 cursor-pointer transition-all hover:shadow-md ${cc.bg} ${cc.border}`}
                  onClick={() => setActiveReference(hl.reference)}
                >
                  <p className={`font-extrabold text-base ${cc.text}`}>{hl.reference}</p>
                  <p className="text-xs text-gray-500 mt-1">{hl.translation.toUpperCase()}</p>
                  {ann.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2 italic line-clamp-2">{ann[0].text}</p>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleRemoveHighlight(hl.id); }}
                    className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sermonRefs.length === 0 && highlights.length === 0 && (
        <div className="py-16 text-center bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200">
          <BookOpen className="w-12 h-12 text-blue-300 mx-auto mb-4" />
          <p className="text-gray-500 font-semibold">No scripture references detected yet.</p>
          <p className="text-gray-400 text-sm mt-1">Use the search bar above to look up any verse.</p>
        </div>
      )}

      {/* Verse modal */}
      {activeReference && (
        <VerseModal
          reference={activeReference}
          translation={translation}
          highlights={highlights}
          annotations={annotations}
          onClose={() => setActiveReference(null)}
          onAddHighlight={handleAddHighlight}
          onRemoveHighlight={handleRemoveHighlight}
          onSaveAnnotation={handleSaveAnnotation}
          onRemoveAnnotation={handleRemoveAnnotation}
          onChangeTranslation={setTranslation}
          saveAction={
            activeSermonScripture
              ? {
                  saved: savedRefs.has(activeSermonScripture.reference),
                  onToggle: () => handleSaveScripture(activeSermonScripture),
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
