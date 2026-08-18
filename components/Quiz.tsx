import React, { useState } from 'react';
import { QuizQuestion } from '../types';
import { Button } from './Button';
import { CheckCircle2, XCircle, RefreshCcw, ArrowRight, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuizProps { questions: QuizQuestion[]; }

export const Quiz: React.FC<QuizProps> = ({ questions }) => {
  const [idx,      setIdx]      = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score,    setScore]    = useState(0);
  const [done,     setDone]     = useState(false);

  const confirm = () => {
    if (selected === null) return;
    setAnswered(true);
    if (selected === questions[idx].correctIndex) setScore(s => s + 1);
  };

  const next = () => {
    if (idx < questions.length - 1) { setIdx(i => i + 1); setSelected(null); setAnswered(false); }
    else setDone(true);
  };

  const reset = () => { setIdx(0); setSelected(null); setAnswered(false); setScore(0); setDone(false); };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center px-8"
      >
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center mb-5">
          <Award className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Quiz complete!</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">You scored {score} of {questions.length}</p>
        <div className="text-5xl font-black text-blue-600 dark:text-blue-400 mb-8">{pct}%</div>
        <Button onClick={reset} className="px-8">
          <RefreshCcw className="w-4 h-4 mr-2" /> Try again
        </Button>
      </motion.div>
    );
  }

  const q = questions[idx];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {idx + 1} / {questions.length}
        </span>
        <div className="h-1.5 w-40 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-600 rounded-full"
            animate={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 md:p-8"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 leading-snug">{q.question}</h3>

          <div className="space-y-3 mb-6">
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect  = i === q.correctIndex;
              const showGood   = answered && isCorrect;
              const showBad    = answered && isSelected && !isCorrect;

              return (
                <button
                  key={i}
                  onClick={() => !answered && setSelected(i)}
                  disabled={answered}
                  className={`
                    w-full text-left px-5 py-3.5 rounded-xl border-2 text-sm font-medium
                    flex items-center justify-between transition-all duration-150
                    ${showGood  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                    : showBad   ? 'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-800 dark:text-red-200'
                    : isSelected? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-800 dark:text-blue-200'
                    :             'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}
                  `}
                >
                  <span>{opt}</span>
                  {showGood && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                  {showBad  && <XCircle      className="w-5 h-5 text-red-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Explanation</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">{q.explanation}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end">
            {!answered
              ? <Button onClick={confirm} disabled={selected === null} className="px-8">Confirm</Button>
              : <Button onClick={next} className="px-8">
                  {idx === questions.length - 1 ? 'Finish' : 'Next'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            }
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
