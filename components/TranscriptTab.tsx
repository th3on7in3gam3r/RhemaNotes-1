import React, { useState, useRef } from 'react';
import { SermonSummaryOutput } from '../types';
import { Highlighter } from 'lucide-react';

interface TranscriptTabProps {
  summary: SermonSummaryOutput;
  onUpdateSummary?: (updated: SermonSummaryOutput) => void;
}

export const TranscriptTab: React.FC<TranscriptTabProps> = ({ summary, onUpdateSummary }) => {
  const [selectedText, setSelectedText] = useState('');
  const [showTooltip,  setShowTooltip]  = useState(false);
  const [tooltipPos,   setTooltipPos]   = useState({ x: 0, y: 0 });

  const handleSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      setSelectedText(sel.toString().trim());
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 48 });
      setShowTooltip(true);
    } else {
      setShowTooltip(false);
    }
  };

  const addHighlight = () => {
    if (!onUpdateSummary || !selectedText) return;
    onUpdateSummary({ ...summary, highlights: [...(summary.highlights || []), selectedText] });
    setSelectedText('');
    setShowTooltip(false);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="p-6 md:p-8 relative">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Clean Transcript</h3>
        <span className="text-xs text-slate-400 dark:text-slate-600 italic">Select text to highlight</span>
      </div>

      {/* Floating highlight button — fixed so it works inside any scroll container */}
      {showTooltip && (
        <button
          onMouseDown={e => { e.preventDefault(); addHighlight(); }}
          className="fixed z-50 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xl flex items-center space-x-1.5 animate-in fade-in zoom-in-75 duration-150 hover:bg-blue-700 active:scale-95"
          style={{ top: tooltipPos.y, left: tooltipPos.x, transform: 'translateX(-50%)' }}
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span>Highlight</span>
        </button>
      )}

      {summary.clean_transcript ? (
        <p
          className="text-slate-700 dark:text-slate-300 leading-loose text-[15px] whitespace-pre-wrap selection:bg-yellow-200 dark:selection:bg-yellow-800"
          onMouseUp={handleSelection}
          onKeyUp={handleSelection}
        >
          {summary.clean_transcript}
        </p>
      ) : (
        <div className="py-16 text-center">
          <p className="text-slate-400 dark:text-slate-600 italic">No transcript available.</p>
        </div>
      )}
    </div>
  );
};
