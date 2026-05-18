import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Button } from './components/Button';
import { AudioRecorder } from './components/AudioRecorder';
import { SermonSummary } from './components/SermonSummary';
import { SermonHistory } from './components/SermonHistory';
import { Pricing } from './components/Pricing';
import { PaymentSuccess } from './components/PaymentSuccess';
import { TermsOfService, PrivacyPolicy } from './components/LegalPages';
import { useSubscription } from './hooks/useSubscription';
import { Onboarding } from './components/Onboarding';
import { processSermonTranscript, processSermonFile, processSermonYoutubeUrl } from './services/geminiService';
import { getSermonHistory, saveSermonToHistory, deleteSermonFromHistory } from './services/storageService';
import { setPageMeta, HOME_META, HISTORY_META } from './services/seoService';
import { SermonSummaryOutput, SermonHistoryItem, UserNote } from './types';
import { DEMO_SERMON } from './demoSermon';
import {
  BookOpen, Mic, Upload, FileAudio, FileVideo,
  FileText, Video as Youtube, Headphones, ArrowRight,
  Sparkles, Clock, CheckCircle2, Loader2, AlertCircle,
  Cross, Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUser } from '@clerk/react';

type AppScreen = 'home' | 'listening' | 'summary' | 'upload' | 'history' | 'youtube' | 'pricing' | 'success' | 'terms' | 'privacy';

// ── Processing overlay ────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  'Awakening the transcript…',
  'The Spirit is moving through the Word…',
  'Illuminating key truths…',
  'Gathering the scriptures…',
  'Preparing your spiritual study guide…',
];

const ProcessingOverlay: React.FC<{ youtubeStep?: string }> = ({ youtubeStep }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep(s => (s + 1) % PROCESSING_STEPS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/90 backdrop-blur-xl">
      <div className="relative w-32 h-32 mb-12">
        {/* Divine Halo */}
        <div className="absolute inset-0 rounded-full border-4 border-amber-200/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-amber-200/40 animate-pulse" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 flex items-center justify-center shadow-[0_0_50px_rgba(253,230,138,0.3)]">
            <BookOpen className="w-8 h-8 text-indigo-900" />
          </div>
        </div>
        
        {/* Orbiting lights */}
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full bg-amber-400 blur-[2px]"
            style={{ 
              animation: `orbit 3s linear infinite`,
              animationDelay: `${i * 1}s`
            }}
          />
        ))}
      </div>

      <h2 className="text-3xl font-serif font-black text-amber-50 mb-4 tracking-tight">Processing Sermon</h2>

      <div className="h-8 overflow-hidden text-center">
        <AnimatePresence mode="wait">
          <motion.p 
            key={youtubeStep ?? step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-amber-200/70 text-lg font-serif italic"
          >
            {youtubeStep ?? PROCESSING_STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-12 w-64 h-1.5 bg-indigo-900/50 rounded-full overflow-hidden border border-indigo-800">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-200 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)]"
          initial={{ width: '0%' }}
          animate={{ width: `${((step + 1) / PROCESSING_STEPS.length) * 100}%` }}
          transition={{ duration: 2.6, ease: "linear" }}
        />
      </div>
    </div>
  );
};

// ── Home screen input card ────────────────────────────────────────────────────

interface InputCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  accent?: 'gold' | 'indigo' | 'rose';
  badge?: string;
}

const InputCard: React.FC<InputCardProps> = ({
  icon: Icon, title, description, onClick, accent = 'indigo', badge
}) => {
  const themes = {
    gold: { bg: 'bg-amber-50', icon: 'text-amber-600', hover: 'hover:border-amber-200' },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', hover: 'hover:border-indigo-200' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', hover: 'hover:border-rose-200' },
  };
  const theme = themes[accent];

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col items-center text-center
        sacred-card sacred-card-hover p-8
        ${theme.hover}
        focus:outline-none focus:ring-2 focus:ring-amber-500/50
      `}
    >
      {badge && (
        <div className="absolute top-4 right-4 bg-amber-400 text-amber-950 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase shadow-sm">
          {badge}
        </div>
      )}
      <div className={`w-16 h-16 rounded-2xl ${theme.bg} flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform duration-300`}>
        <Icon className={`w-8 h-8 ${theme.icon}`} />
      </div>
      <h3 className="text-lg font-serif font-black text-indigo-950 mb-2">{title}</h3>
      <p className="text-sm text-indigo-900/60 leading-relaxed font-medium">{description}</p>
      
      <div className="mt-6 flex items-center text-xs font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
        Begin Journey <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </div>
    </button>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sermonOutput, setSermonOutput] = useState<SermonSummaryOutput | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [includeReflection, setIncludeReflection] = useState(false);
  const [history, setHistory] = useState<SermonHistoryItem[]>([]);
  const [initialUploadMode, setInitialUploadMode] = useState<'text' | 'file'>('text');
  const [youtubeStep, setYoutubeStep] = useState<string | undefined>();
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { user } = useUser();

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const { tier, isPro, isLoadingTier } = useSubscription();

  useEffect(() => { 
    getSermonHistory().then(setHistory); 
    
    // Check if first time user
    const hasOnboarded = localStorage.getItem('rhemanotes_onboarded');
    if (!hasOnboarded) setShowOnboarding(true);

    // Detect Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('session_id')) {
      setCurrentScreen('success');
      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('rhemanotes_onboarded', 'true');
    setShowOnboarding(false);
  };

  const handleProcessTranscript = useCallback(async (transcript: string, liveNotes?: UserNote[], file?: File) => {
    setIsLoading(true);
    setError(null);
    try {
      let result;
      if (file) {
        result = await processSermonFile(file, includeReflection);
        result.audio_blob = file;
      } else {
        result = await processSermonTranscript(transcript, includeReflection);
      }
      if (liveNotes) result.user_notes = [...(result.user_notes || []), ...liveNotes];
      const savedItem = await saveSermonToHistory(result);
      setHistory(prev => [savedItem, ...prev]);
      setSermonOutput(result);
      setSelectedHistoryId(savedItem.id);
      setCurrentScreen('summary');
    } catch (err: any) {
      setError(err.message || 'Failed to process sermon. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [includeReflection]);

  const handleProcessFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await processSermonFile(file, includeReflection);
      result.audio_blob = file;
      const savedItem = await saveSermonToHistory(result);
      setHistory(prev => [savedItem, ...prev]);
      setSermonOutput(result);
      setSelectedHistoryId(savedItem.id);
      setCurrentScreen('summary');
    } catch (err: any) {
      setError(err.message || 'Failed to process file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [includeReflection]);

  const handleSelectSermon = useCallback((item: SermonHistoryItem) => {
    setSermonOutput(item.summary);
    setSelectedHistoryId(item.id);
    setCurrentScreen('summary');
  }, []);

  const handleToggleReflection = useCallback(() => setIncludeReflection(p => !p), []);
  const handleUpdateHistory = useCallback(async () => {
    const newHistory = await getSermonHistory();
    setHistory(newHistory);
  }, []);

  const handleDeleteItem = async (id: string) => {
    await deleteSermonFromHistory(id);
    setHistory(prev => prev.filter(i => i.id !== id));
    if (selectedHistoryId === id) {
      setCurrentScreen('history');
      setSermonOutput(null);
      setSelectedHistoryId(null);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    const savedItem = await saveSermonToHistory(DEMO_SERMON);
    setHistory(prev => [savedItem, ...prev]);
    setSermonOutput(DEMO_SERMON);
    setSelectedHistoryId(savedItem.id);
    setCurrentScreen('summary');
    setIsLoading(false);
  };

  const handleGoHome = useCallback(() => {
    setCurrentScreen('home');
    setSermonOutput(null);
    setSelectedHistoryId(null);
    setError(null);
    setIncludeReflection(false);
    setPageMeta(HOME_META);
  }, []);

  const handleNavigate = useCallback((screen: AppScreen) => {
    setCurrentScreen(screen);
    if (screen === 'home') { setSermonOutput(null); setSelectedHistoryId(null); setPageMeta(HOME_META); }
    if (screen === 'history') setPageMeta(HISTORY_META);
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      /* ── Home ── */
      case 'home':
        return (
          <div className="flex flex-col items-center space-y-24 py-12 animate-in fade-in duration-700">
            {/* Hero */}
            <div className="flex flex-col items-center text-center space-y-8 max-w-3xl">
              {/* Glowing Hero Logo Container */}
              <div className="relative group mb-2">
                <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-indigo-500/20 to-amber-500/20 blur-2xl group-hover:scale-110 transition-transform duration-500 opacity-80" />
                <img 
                  src="/logo.png" 
                  alt="RhemaNotes Logo" 
                  className="relative w-28 h-28 rounded-[2.5rem] shadow-2xl border border-indigo-50 group-hover:scale-105 transition-transform duration-300 z-10"
                />
              </div>

              <div className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-sm border border-indigo-50">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-indigo-900/60 tracking-wider uppercase">AI-Illuminated Sermon Study</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-serif font-black text-indigo-950 tracking-tight leading-[0.9]">
                Be still and<br />
                <span className="text-gradient-sacred italic">know the Word.</span>
              </h1>
              
              <p className="text-xl text-indigo-900/60 leading-relaxed font-serif max-w-xl mx-auto italic">
                Record, upload, or paste any sermon. RhemaNotes distills the spirit into 
                scripture links, study tools, and AI-guided reflections.
              </p>

              <div className="flex items-center justify-center gap-4 pt-4">
                 <button onClick={() => setCurrentScreen('listening')} className="btn-sacred-primary px-8 py-4 text-lg">
                    <Mic className="w-5 h-5" />
                    Record Live
                 </button>
                 <button onClick={handleLoadDemo} className="btn-sacred-gold px-8 py-4 text-lg">
                    Explore Demo
                 </button>
              </div>
            </div>

            {/* Input method grid */}
            <div className="w-full">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                  <InputCard
                    icon={Mic}
                    accent="rose"
                    title="Live Recording"
                    description="Capture the moment. Add personal notes as the spirit moves you."
                    onClick={() => setCurrentScreen('listening')}
                  />
                  <InputCard
                    icon={Youtube}
                    accent="gold"
                    title="YouTube Library"
                    description="Paste a sermon link. We'll extract the transcript and insights instantly."
                    onClick={() => isPro ? setCurrentScreen('youtube') : setCurrentScreen('pricing')}
                    badge={!isPro ? "PRO" : undefined}
                  />
                  <InputCard
                    icon={FileAudio}
                    accent="indigo"
                    title="Audio Upload"
                    description="Import MP3s or recordings. Perfect for your church's archive."
                    onClick={() => { setInitialUploadMode('file'); setCurrentScreen('upload'); }}
                  />
                  <InputCard
                    icon={FileText}
                    accent="indigo"
                    title="Paste Text"
                    description="Drop in transcripts or raw notes to build a study guide."
                    onClick={() => { setInitialUploadMode('text'); setCurrentScreen('upload'); }}
                  />
                </div>
            </div>

            {/* Recent library section */}
            {history.length > 0 && (
              <div className="w-full space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                     <Waves className="w-6 h-6 text-indigo-300" />
                     <h2 className="text-3xl font-serif font-black text-indigo-950">Recent Journey</h2>
                  </div>
                  <button
                    onClick={() => setCurrentScreen('history')}
                    className="btn-sacred-ghost"
                  >
                    <span>View Library</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Install App Button */}
                  {deferredPrompt && (
                    <button
                      onClick={handleInstall}
                      className="ml-2 px-4 py-2 bg-amber-400 text-amber-950 rounded-xl text-xs font-black shadow-lg animate-pulse"
                    >
                      Install App
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {history.slice(0, 3).map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSermon(item)}
                      className="group text-left sacred-card sacred-card-hover p-6 border-l-4 border-l-amber-200"
                    >
                      <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center text-xs font-bold text-indigo-900/40 uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                         </div>
                         <Sparkles className="w-4 h-4 text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <h4 className="text-xl font-serif font-black text-indigo-950 mb-4 line-clamp-2 group-hover:text-indigo-700 transition-colors">
                        {item.summary.title}
                      </h4>
                      
                      <div className="flex items-center space-x-3">
                        <div className="px-2.5 py-1 bg-amber-50 rounded-lg text-[10px] font-black text-amber-700 uppercase">
                          {item.summary.scriptures.length} Verses
                        </div>
                        <div className="px-2.5 py-1 bg-indigo-50 rounded-lg text-[10px] font-black text-indigo-700 uppercase">
                          {item.summary.key_points.length} Points
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'listening':
        return (
          <AudioRecorder
            onStopRecording={handleProcessTranscript}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
            error={error}
          />
        );

      case 'upload':
        return (
          <UploadSermon
            onProcessTranscript={handleProcessTranscript}
            onProcessFile={handleProcessFile}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
            error={error}
            initialMode={initialUploadMode}
          />
        );

      case 'youtube':
        return (
          <YouTubeProcessor
            onProcessUrl={async (url) => {
              setIsLoading(true);
              setError(null);
              setYoutubeStep('Sourcing and illuminating YouTube sermon…');
              try {
                const result = await processSermonYoutubeUrl(url, includeReflection);
                if (!result.title || result.title === 'Sermon Summary') {
                  result.title = 'YouTube Sermon Study';
                }
                const savedItem = await saveSermonToHistory(result);
                setHistory(prev => [savedItem, ...prev]);
                setSermonOutput(result);
                setSelectedHistoryId(savedItem.id);
                setCurrentScreen('summary');
              } catch (err: any) {
                setError(err.message || 'Failed to process YouTube link.');
              } finally {
                setIsLoading(false);
                setYoutubeStep(undefined);
              }
            }}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
          />
        );

      case 'history':
        return (
          <SermonHistory
            history={history}
            onSelectSermon={handleSelectSermon}
            onDeleteItem={handleDeleteItem}
            onGoHome={handleGoHome}
            onLoadDemo={handleLoadDemo}
          />
        );

      case 'summary':
        return sermonOutput ? (
          <SermonSummary
            summary={sermonOutput}
            onGoHome={handleGoHome}
            includeReflection={includeReflection}
            onToggleReflection={handleToggleReflection}
            isLoading={isLoading}
            historyId={selectedHistoryId || undefined}
            onUpdateHistory={handleUpdateHistory}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <p className="text-indigo-900/40 font-serif text-lg mb-6 italic">No sermon journey available.</p>
            <button onClick={handleGoHome} className="btn-sacred-primary">Go Home</button>
          </div>
        );

      case 'pricing':
        return (
          <Pricing 
            onGoHome={handleGoHome} 
            onSelectPlan={async (planId, cycle) => {
              if (!user) {
                alert('Please sign in to your account first to upgrade!');
                // Optional: Trigger Clerk sign-in modal here if you want
                return;
              }
              // Map plan IDs to actual price IDs from env
              let stripePriceId = '';
              
              if (planId === 'free') {
                stripePriceId = import.meta.env.VITE_STRIPE_PRICE_FREE;
              } else if (planId === 'pro') {
                stripePriceId = cycle === 'annual' 
                  ? import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL 
                  : import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY;
              } else if (planId === 'church') {
                stripePriceId = import.meta.env.VITE_STRIPE_PRICE_CHURCH;
              }

              if (!stripePriceId) {
                console.error('No Price ID found for plan:', planId);
                return;
              }

              setIsLoading(true);
              try {
                const response = await fetch('/api/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    priceId: stripePriceId,
                    userId: user?.id || 'guest',
                    userEmail: user?.primaryEmailAddress?.emailAddress || '',
                  }),
                });

                const data = await response.json() as any;
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  throw new Error(data.error || 'Failed to create checkout session');
                }
              } catch (err: any) {
                console.error('Checkout error:', err);
                alert('Checkout Error: ' + (err.message || 'Unknown error'));
                setError(err.message || 'Payment system currently unavailable. Please try again later.');
              } finally {
                setIsLoading(false);
              }
            }} 
          />
        );

      case 'success':
        return <PaymentSuccess onGoHome={handleGoHome} tier={tier === 'free' ? 'pro' : tier} />;

      case 'terms':
        return <TermsOfService onBack={handleGoHome} />;

      case 'privacy':
        return <PrivacyPolicy onBack={handleGoHome} />;

      default:
        return null;
    }
  };

  return (
    <Layout onNavigate={handleNavigate} currentScreen={currentScreen} tier={tier}>
      {renderScreen()}

      <AnimatePresence>
        {isLoading && <ProcessingOverlay youtubeStep={youtubeStep} />}
      </AnimatePresence>

      <AnimatePresence>
        {error && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-rose-900 text-white text-sm font-bold px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-3 border-2 border-rose-800"
          >
            <AlertCircle className="w-5 h-5 text-rose-300" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 p-1 hover:bg-rose-800 rounded-full transition-colors">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Onboarding Journey */}
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
    </Layout>
  );
};

// ── Upload screen ─────────────────────────────────────────────────────────────

interface UploadSermonProps {
  onProcessTranscript: (t: string, n?: UserNote[]) => Promise<void>;
  onProcessFile: (f: File) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  initialMode?: 'text' | 'file';
}

const UploadSermon: React.FC<UploadSermonProps> = ({
  onProcessTranscript, onProcessFile, onCancel, isLoading, error, initialMode = 'text',
}) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'text' | 'file'>(initialMode);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async () => {
    setBusy(true);
    if (mode === 'text') await onProcessTranscript(text);
    else if (file)       await onProcessFile(file);
    setBusy(false);
  };

  const disabled = isLoading || busy || (mode === 'text' ? !text.trim() : !file);

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-3xl sacred-card p-8 md:p-16">
        <h2 className="text-4xl font-serif font-black text-indigo-950 mb-8 tracking-tight">Upload Sermon</h2>

        <div className="flex bg-indigo-50/50 p-1.5 rounded-2xl mb-10 w-full max-w-xs border border-indigo-100">
          {(['text', 'file'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-black transition-all ${
                mode === m
                  ? 'bg-white text-indigo-900 shadow-md'
                  : 'text-indigo-900/40 hover:text-indigo-900'
              }`}
            >
              {m === 'text' ? <FileText className="w-4 h-4" /> : <FileAudio className="w-4 h-4" />}
              <span>{m === 'text' ? 'Paste Text' : 'Media File'}</span>
            </button>
          ))}
        </div>

        {mode === 'text' ? (
          <textarea
            className="
              w-full h-80 p-6 mb-8
              bg-white border-2 border-indigo-50
              rounded-3xl resize-none text-indigo-950 font-serif text-lg
              placeholder:text-indigo-200 leading-relaxed
              focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-200
              transition-all
            "
            placeholder="Let the words flow here…"
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={isLoading || busy}
          />
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="
              w-full h-64 mb-8 rounded-3xl
              border-2 border-dashed border-indigo-100
              flex flex-col items-center justify-center cursor-pointer
              hover:border-amber-300 hover:bg-amber-50/30
              transition-all group bg-indigo-50/20
            "
          >
            <input ref={fileRef} type="file" className="hidden" accept="audio/*,video/*" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
            {file ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  {file.type.startsWith('video') ? <FileVideo className="w-10 h-10 text-amber-700" /> : <FileAudio className="w-10 h-10 text-amber-700" />}
                </div>
                <p className="font-serif font-black text-xl text-indigo-950">{file.name}</p>
                <p className="text-sm text-indigo-900/40 mt-1 font-bold">{(file.size / 1024 / 1024).toFixed(2)} MB · Change file</p>
              </div>
            ) : (
              <div className="text-center px-8">
                <div className="w-20 h-20 bg-indigo-100/50 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform">
                  <Upload className="w-10 h-10 text-indigo-400" />
                </div>
                <p className="font-serif font-black text-xl text-indigo-950">Bring your sermon file</p>
                <p className="text-sm text-indigo-900/40 mt-1 font-bold">MP3, MP4, WAV, M4A or Video</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={handle} disabled={disabled} className="btn-sacred-primary flex-1 py-4 text-lg">
            {busy || isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Begin Illumination'}
          </button>
          <button onClick={onCancel} className="btn-sacred-ghost flex-1 py-4 text-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ── YouTube screen ────────────────────────────────────────────────────────────

interface YouTubeProcessorProps {
  onProcessUrl: (url: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const YouTubeProcessor: React.FC<YouTubeProcessorProps> = ({ onProcessUrl, onCancel, isLoading }) => {
  const [url, setUrl] = useState('');

  const handle = () => {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      alert('Please enter a valid YouTube link.');
      return;
    }
    onProcessUrl(url);
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-2xl sacred-card p-12 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
          <Youtube className="w-10 h-10 text-rose-500" />
        </div>

        <h2 className="text-4xl font-serif font-black text-indigo-950 mb-3 tracking-tight">YouTube Sermon</h2>
        <p className="text-indigo-900/40 font-serif text-lg mb-10 italic">
          Paste the link to a sermon that has moved you. We'll sourcing the transcript and reveal its deeper truths.
        </p>

        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isLoading && handle()}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={isLoading}
          className="
            w-full p-6 mb-4
            bg-white border-2 border-indigo-50
            rounded-3xl text-indigo-950 font-serif text-lg
            placeholder:text-indigo-100
            focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-200
            disabled:opacity-50 transition-all
          "
        />

        <p className="text-xs text-indigo-900/30 font-bold mb-10 uppercase tracking-widest">
           Supports most videos with active captions
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button
            onClick={handle}
            disabled={isLoading || !url.trim()}
            className="btn-sacred-primary flex-1 py-4 bg-rose-600 hover:bg-rose-700 shadow-rose-200"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Process YouTube Sermon'}
          </button>
          <button onClick={onCancel} className="btn-sacred-ghost flex-1 py-4">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
