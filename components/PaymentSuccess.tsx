import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, Crown, BookOpen, ArrowRight, Loader2 } from 'lucide-react';
import type { UserTier } from '../constants/features';

interface PaymentSuccessProps {
  onGoHome: () => void;
  sessionId?: string | null;
  onActivatePlan?: (sessionId?: string | null) => Promise<UserTier | void>;
}

export const PaymentSuccess: React.FC<PaymentSuccessProps> = ({
  onGoHome,
  sessionId,
  onActivatePlan,
}) => {
  const [count, setCount] = useState(5);
  const [tier, setTier] = useState<UserTier>('pro');
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const activate = async () => {
      try {
        const synced = await onActivatePlan?.(sessionId);
        if (!cancelled && synced) setTier(synced);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };
    void activate();
    return () => {
      cancelled = true;
    };
  }, [sessionId, onActivatePlan]);

  useEffect(() => {
    if (isSyncing) return;
    const timer = setInterval(() => setCount(c => c - 1), 1000);
    const redirect = setTimeout(onGoHome, 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(redirect);
    };
  }, [isSyncing, onGoHome]);

  const isChurch = tier === 'church';

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      {isSyncing ? (
        <div className="flex flex-col items-center gap-4 mb-8">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-indigo-900/60 font-medium">Activating your plan…</p>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="relative mb-8"
          >
            <div className={`w-28 h-28 rounded-[32px] flex items-center justify-center shadow-2xl ${
              isChurch ? 'bg-amber-400' : 'bg-indigo-900'
            }`}>
              {isChurch
                ? <Crown className="w-14 h-14 text-amber-950" />
                : <Sparkles className="w-14 h-14 text-amber-200" />
              }
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-4 rounded-full border-2 border-dashed border-amber-300/40"
            />
            <CheckCircle className="absolute -bottom-3 -right-3 w-9 h-9 text-green-500 bg-white rounded-full shadow-lg" />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-4xl font-serif font-black text-indigo-950 mb-3">
              {isChurch ? '⛪ Welcome to The Harvest!' : '🌿 Welcome to The Vine!'}
            </h1>
            <p className="text-lg text-indigo-900/60 max-w-md mx-auto mb-2">
              {isChurch
                ? 'Your congregation now has unlimited access to RhemaNotes. May every sermon bear fruit!'
                : 'You now have unlimited sermon summaries, YouTube processing, and more. Go deeper in the Word!'
              }
            </p>
            <p className="text-sm text-indigo-900/40 italic mb-8">
              "I am the vine; you are the branches." — John 15:5
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 w-full max-w-sm"
          >
            {[
              'Unlimited Sermon Summaries',
              'YouTube & Audio Processing',
              'Interactive Study Chat',
              isChurch ? 'Church Library & Branding' : 'Quiz & Flashcard Generation',
            ].map((feature) => (
              <div key={feature} className="flex items-center space-x-2 bg-green-50 border border-green-100 rounded-2xl px-4 py-3 text-left">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm font-semibold text-green-800">{feature}</span>
              </div>
            ))}
          </motion.div>

          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            onClick={onGoHome}
            className="flex items-center space-x-2 px-8 py-4 bg-indigo-900 text-amber-100 font-black rounded-2xl shadow-xl hover:bg-indigo-800 active:scale-95 transition-all"
          >
            <BookOpen className="w-5 h-5" />
            <span>Start Scribing Now</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <p className="mt-4 text-xs text-indigo-900/30">
            Redirecting in {count}s...
          </p>
        </>
      )}
    </div>
  );
};
