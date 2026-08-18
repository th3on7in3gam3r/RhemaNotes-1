import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Mic, Sparkles, ArrowRight, X, Heart } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const slides = [
    {
      icon: <Mic className="w-12 h-12 text-rose-400" />,
      title: "Capture the Word",
      description: "Record live during service or upload any sermon audio. We'll handle the transcription with care."
    },
    {
      icon: <BookOpen className="w-12 h-12 text-indigo-400" />,
      title: "Deeper Illumination",
      description: "Instantly see every scripture reference linked to a full Bible reader for deeper study."
    },
    {
      icon: <Sparkles className="w-12 h-12 text-amber-400" />,
      title: "Guided Reflection",
      description: "Interact with the message using our AI study partner to find personal application for your walk."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-indigo-950/40 backdrop-blur-md flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl max-w-lg w-full overflow-hidden relative"
      >
        <button 
          onClick={onComplete}
          className="absolute top-8 right-8 text-indigo-900/20 hover:text-indigo-900 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-24 h-24 bg-indigo-50 rounded-[32px] flex items-center justify-center mb-10 shadow-inner">
                {slides[step].icon}
              </div>
              
              <h2 className="text-3xl font-serif font-black text-indigo-950 mb-4 tracking-tight">
                {slides[step].title}
              </h2>
              
              <p className="text-lg text-indigo-900/40 font-serif italic leading-relaxed mb-10">
                {slides[step].description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {slides.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-indigo-900' : 'w-2 bg-indigo-100'}`} 
                />
              ))}
            </div>

            <button
              onClick={() => step < slides.length - 1 ? setStep(s => s + 1) : onComplete()}
              className="btn-sacred-primary px-8 py-3"
            >
              <span>{step === slides.length - 1 ? "Begin Journey" : "Next Step"}</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>

        <div className="bg-indigo-50/50 py-4 px-12 flex items-center justify-center space-x-2">
           <Heart className="w-3.5 h-3.5 text-rose-500" />
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-900/40">
             Building your spiritual library
           </span>
        </div>
      </motion.div>
    </div>
  );
};
