import React, { useState } from 'react';
import { SermonSummaryOutput } from '../types';
import { Quiz } from './Quiz';
import { Flashcards } from './Flashcards';
import { MindMap } from './MindMap';
import { SermonChat } from './SermonChat';
import { HelpCircle, Layers, Network, MessageSquare, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudySystemProps {
  summary: SermonSummaryOutput;
  onUpdateSummary: (updated: SermonSummaryOutput) => void;
}

type StudyTool = 'quiz' | 'flashcards' | 'mindmap' | 'chat';

const TOOLS: { id: StudyTool; label: string; icon: React.ElementType; accent: string; activeBg: string; activeBorder: string; activeText: string; activeIcon: string }[] = [
  { id: 'quiz',       label: 'Quiz',       icon: HelpCircle,    accent: 'blue',   activeBg: 'bg-blue-50 dark:bg-blue-950/60',    activeBorder: 'border-blue-500',   activeText: 'text-blue-900 dark:text-blue-200',   activeIcon: 'bg-blue-600 text-white' },
  { id: 'flashcards', label: 'Flashcards', icon: Layers,        accent: 'indigo', activeBg: 'bg-indigo-50 dark:bg-indigo-950/60', activeBorder: 'border-indigo-500', activeText: 'text-indigo-900 dark:text-indigo-200', activeIcon: 'bg-indigo-600 text-white' },
  { id: 'mindmap',    label: 'Mind Map',   icon: Network,       accent: 'violet', activeBg: 'bg-violet-50 dark:bg-violet-950/60', activeBorder: 'border-violet-500', activeText: 'text-violet-900 dark:text-violet-200', activeIcon: 'bg-violet-600 text-white' },
  { id: 'chat',       label: 'Chat',       icon: MessageSquare, accent: 'emerald',activeBg: 'bg-emerald-50 dark:bg-emerald-950/60',activeBorder: 'border-emerald-500',activeText: 'text-emerald-900 dark:text-emerald-200',activeIcon: 'bg-emerald-600 text-white' },
];

export const StudySystem: React.FC<StudySystemProps> = ({ summary, onUpdateSummary }) => {
  const [activeTool, setActiveTool] = useState<StudyTool>('quiz');

  const renderTool = () => {
    switch (activeTool) {
      case 'quiz':       return summary.quiz?.length       ? <Quiz questions={summary.quiz} />         : <NoData tool="Quiz" />;
      case 'flashcards': return summary.flashcards?.length ? <Flashcards cards={summary.flashcards} /> : <NoData tool="Flashcards" />;
      case 'mindmap':    return summary.mind_map   ? <MindMap data={summary.mind_map} />       : <NoData tool="Mind Map" />;
      case 'chat':       return <SermonChat summary={summary} onUpdateSummary={onUpdateSummary} />;
      default:           return null;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Tool selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TOOLS.map(tool => {
          const active = activeTool === tool.id;
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`
                flex flex-col items-center justify-center p-5 rounded-2xl border-2
                transition-all duration-200
                ${active
                  ? `${tool.activeBg} ${tool.activeBorder} shadow-soft scale-[1.02]`
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5'
                }
              `}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${active ? tool.activeIcon : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-sm font-bold ${active ? tool.activeText : 'text-slate-500 dark:text-slate-400'}`}>
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tool content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTool}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {renderTool()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const NoData: React.FC<{ tool: string }> = ({ tool }) => (
  <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
    <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
    <p className="font-bold text-slate-400 dark:text-slate-500">No {tool} data</p>
    <p className="text-sm text-slate-400 dark:text-slate-600 text-center max-w-xs mt-1">
      This sermon may have been processed before the study system was added.
    </p>
  </div>
);
