import React, { useState, useEffect } from 'react';
import { SermonSummaryOutput, UserNote, ActionItem } from '../types';
import { Button } from './Button';
import { Plus, Trash2, CheckCircle, Circle, StickyNote, ListTodo, Highlighter, Check } from 'lucide-react';
import { TextWithVerseLinks } from './BibleTab';

interface NotesTabProps {
  summary: SermonSummaryOutput;
  onUpdateSummary: (updated: SermonSummaryOutput) => void;
  onOpenInBible?: (reference: string) => void;
}

export const NotesTab: React.FC<NotesTabProps> = ({ summary, onUpdateSummary, onOpenInBible }) => {
  const [newNote,   setNewNote]   = useState('');
  const [newAction, setNewAction] = useState('');
  const [isSaved,   setIsSaved]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isSaved) {
      const t = setTimeout(() => setIsSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isSaved]);

  const save = (updated: SermonSummaryOutput) => { onUpdateSummary(updated); setIsSaved(true); };

  const addNote = () => {
    if (!newNote.trim()) return;
    save({ ...summary, user_notes: [...(summary.user_notes || []), { id: crypto.randomUUID(), text: newNote, timestamp: Date.now() }] });
    setNewNote('');
  };

  const updateNoteText = (id: string, text: string) =>
    save({ ...summary, user_notes: (summary.user_notes || []).map(n => n.id === id ? { ...n, text } : n) });

  const deleteNote = (id: string) =>
    save({ ...summary, user_notes: (summary.user_notes || []).filter(n => n.id !== id) });

  const addAction = () => {
    if (!newAction.trim()) return;
    save({ ...summary, personal_action_items: [...(summary.personal_action_items || []), { id: crypto.randomUUID(), text: newAction, completed: false }] });
    setNewAction('');
  };

  const updateActionText = (id: string, text: string) =>
    save({ ...summary, personal_action_items: (summary.personal_action_items || []).map(a => a.id === id ? { ...a, text } : a) });

  const toggleAction = (id: string) =>
    save({ ...summary, personal_action_items: (summary.personal_action_items || []).map(a => a.id === id ? { ...a, completed: !a.completed } : a) });

  const deleteAction = (id: string) =>
    save({ ...summary, personal_action_items: (summary.personal_action_items || []).filter(a => a.id !== id) });

  const bibleHighlights = summary.bible_highlights ?? [];

  return (
    <div className="p-6 md:p-8 relative">
      {/* Auto-save badge */}
      {isSaved && (
        <div className="absolute top-4 right-4 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 animate-in fade-in slide-in-from-top-2 z-10">
          <Check className="w-3 h-3" />
          <span>Saved</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* ── Personal Notes ── */}
        <div>
          <div className="flex items-center space-x-2 mb-5">
            <StickyNote className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Personal Notes</h3>
          </div>

          <div className="flex space-x-2 mb-5">
            <input
              type="text"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNote()}
              placeholder="Add a thought or insight…"
              className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              onClick={addNote}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {!(summary.user_notes?.length) ? (
              <div className="py-10 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <StickyNote className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-600">No notes yet. Add one above.</p>
              </div>
            ) : (
              (summary.user_notes || []).map(note => (
                <div
                  key={note.id}
                  className="group bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 relative hover:-translate-y-0.5 transition-transform"
                >
                  {editingId === note.id ? (
                    <textarea
                      autoFocus
                      className="w-full bg-white dark:bg-slate-700 p-2 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800 dark:text-slate-100 resize-none"
                      value={note.text}
                      onChange={e => updateNoteText(note.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      rows={3}
                    />
                  ) : (
                    <div
                      className="text-sm text-slate-700 dark:text-slate-300 pr-6 cursor-pointer leading-relaxed"
                      onClick={() => setEditingId(note.id)}
                    >
                      <TextWithVerseLinks
                        text={note.text}
                        highlights={bibleHighlights}
                        onVerseClick={ref => onOpenInBible?.(ref)}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-slate-400 mt-2 block">
                    {note.timestamp_offset !== undefined
                      ? `At ${Math.floor(note.timestamp_offset / 60)}:${(note.timestamp_offset % 60).toString().padStart(2, '0')}`
                      : new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Action Items ── */}
        <div>
          <div className="flex items-center space-x-2 mb-5">
            <ListTodo className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Action Items</h3>
          </div>

          <div className="flex space-x-2 mb-5">
            <input
              type="text"
              value={newAction}
              onChange={e => setNewAction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAction()}
              placeholder="What will you do differently?"
              className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              onClick={addAction}
              className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {!(summary.personal_action_items?.length) ? (
              <div className="py-10 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <ListTodo className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-600">No action items yet.</p>
              </div>
            ) : (
              (summary.personal_action_items || []).map(action => (
                <div
                  key={action.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all hover:-translate-y-0.5 ${
                    action.completed
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-60'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <button onClick={() => toggleAction(action.id)} className="flex-shrink-0">
                      {action.completed
                        ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                        : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />}
                    </button>
                    {editingId === action.id ? (
                      <input
                        autoFocus
                        className="flex-1 bg-white dark:bg-slate-700 px-2 py-1 border border-emerald-300 rounded text-sm outline-none"
                        value={action.text}
                        onChange={e => updateActionText(action.id, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingId(action.id)}
                        className={`text-sm cursor-pointer truncate ${action.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {action.text}
                      </span>
                    )}
                  </div>
                  <button onClick={() => deleteAction(action.id)} className="ml-3 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Highlights ── */}
      <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2 mb-5">
          <Highlighter className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Transcript Highlights
          </h3>
        </div>

        {!(summary.highlights?.length) ? (
          <div className="py-10 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Highlighter className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-400 dark:text-slate-600">Select text in the Transcript tab to save highlights here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(summary.highlights || []).map((highlight, index) => (
              <div
                key={index}
                className="group relative bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-2xl p-4 hover:-translate-y-0.5 transition-transform"
              >
                <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">&ldquo;{highlight}&rdquo;</p>
                <button
                  onClick={() => save({ ...summary, highlights: (summary.highlights || []).filter((_, i) => i !== index) })}
                  className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-full shadow p-1.5 opacity-0 group-hover:opacity-100 transition-all border border-slate-100 dark:border-slate-700"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
