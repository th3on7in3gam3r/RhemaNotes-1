import React, { useState } from 'react';
import { Flashcard } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface FlashcardsProps { cards: Flashcard[]; }

export const Flashcards: React.FC<FlashcardsProps> = ({ cards }) => {
  const [idx,     setIdx]     = useState(0);
  const [flipped, setFlipped] = useState(false);

  const go = (dir: 1 | -1) => {
    setFlipped(false);
    setTimeout(() => setIdx(i => (i + dir + cards.length) % cards.length), 120);
  };

  if (!cards?.length) return null;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center py-4">
      {/* Counter */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
        Card {idx + 1} of {cards.length}
      </p>

      {/* Card */}
      <div
        className="relative w-full aspect-[3/2] perspective-1000 cursor-pointer select-none"
        onClick={() => setFlipped(f => !f)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 280, damping: 22 }}
            className="w-full h-full relative preserve-3d"
          >
            {/* Front */}
            <div className={`absolute inset-0 p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-card border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center backface-hidden ${flipped ? 'pointer-events-none' : ''}`}>
              <p className="text-xl font-black text-slate-900 dark:text-white leading-snug">
                {cards[idx].front}
              </p>
              <div className="absolute bottom-5 flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <RotateCw className="w-3 h-3" />
                <span>Tap to flip</span>
              </div>
            </div>

            {/* Back */}
            <div className={`absolute inset-0 p-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl shadow-card flex flex-col items-center justify-center text-center backface-hidden rotate-y-180 ${!flipped ? 'pointer-events-none' : ''}`}>
              <p className="text-lg font-bold text-white leading-relaxed">
                {cards[idx].back}
              </p>
              <div className="absolute bottom-5 flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-200">
                <RotateCw className="w-3 h-3" />
                <span>Tap to flip back</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center space-x-5 mt-8">
        <button
          onClick={e => { e.stopPropagation(); go(-1); }}
          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:border-blue-400 hover:text-blue-600 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex space-x-1.5">
          {cards.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200 dark:bg-slate-700'}`}
            />
          ))}
        </div>

        <button
          onClick={e => { e.stopPropagation(); go(1); }}
          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:border-blue-400 hover:text-blue-600 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
