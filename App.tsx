import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Button } from './components/Button';
import { AudioRecorder } from './components/AudioRecorder';
import { SermonSummary } from './components/SermonSummary';
import { SermonHistory } from './components/SermonHistory';
import { Pricing } from './components/Pricing';
import { PaymentSuccess } from './components/PaymentSuccess';
import { TermsOfService, PrivacyPolicy } from './components/LegalPages';
import { UserProfile } from './components/UserProfile';
import { useSubscription } from './hooks/useSubscription';
import { Onboarding } from './components/Onboarding';
import { getSermonHistory, saveSermonToHistory, deleteSermonFromHistory, claimGuestSermons } from './services/storageService';
import { getSavedScriptures } from './services/storageService';
import { getYouTubeTranscript } from './services/youtubeService';
import { setAuthTokenGetter } from './services/apiAuth';
import { useSermonProcessing } from './hooks/useSermonProcessing';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { TranscriptReviewModal } from './components/TranscriptReviewModal';
import { UploadSermon } from './components/UploadSermon';
import { YouTubeProcessor } from './components/YouTubeProcessor';
import { PendingSyncBanner } from './components/PendingSyncBanner';
import { PendingPartialTranscriptBanner } from './components/PendingPartialTranscriptBanner';
import { setPageMeta, HOME_META, HISTORY_META } from './services/seoService';
import { SermonSummaryOutput, SermonHistoryItem, UserNote, SavedScripture } from './types';
import { DEMO_SERMON } from './demoSermon';
import {
  Mic, FileAudio,
  FileText, Video as Youtube, Headphones, ArrowRight,
  Sparkles, Clock, CheckCircle2, Loader2, AlertCircle,
  Cross, Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUser, useAuth } from '@clerk/react';
import logoImg from './logo.png';

type AppScreen = 'home' | 'listening' | 'summary' | 'upload' | 'history' | 'youtube' | 'pricing' | 'success' | 'terms' | 'privacy' | 'profile';

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
  const [sermonOutput, setSermonOutput] = useState<SermonSummaryOutput | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [includeReflection, setIncludeReflection] = useState(false);
  const [history, setHistory] = useState<SermonHistoryItem[]>([]);
  const [savedScriptures, setSavedScriptures] = useState<SavedScripture[]>(() => getSavedScriptures());
  const [initialUploadMode, setInitialUploadMode] = useState<'text' | 'file' | 'transcribe'>('text');
  const [uploadDraftText, setUploadDraftText] = useState('');
  
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { user, isLoaded: clerkLoaded } = useUser();
  const { getToken } = useAuth();
  const { tier, isPro, isLoadingTier, getLimit, refreshTier, tierSyncError } = useSubscription();

  useEffect(() => {
    if (!clerkLoaded) return;
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken, clerkLoaded, user?.id]);

  const onSermonSaved = useCallback((item: SermonHistoryItem, summary: SermonSummaryOutput) => {
    setHistory((prev) => [item, ...prev]);
    setSermonOutput(summary);
    setSelectedHistoryId(item.id);
    setCurrentScreen('summary');
  }, []);

  const {
    isLoading,
    error,
    setError,
    processingStatus,
    pendingReview,
    processText,
    processAudioFile,
    processFileDirect,
    transcribeOnlyFile,
    openTranscriptReview,
    confirmTranscriptReview,
    saveTranscriptForLater,
    dismissTranscriptReview,
    cancelActiveProcessing,
  } = useSermonProcessing({
    userId: user?.id || 'guest',
    includeReflection,
    onSaved: onSermonSaved,
    maxAudioMinutes: getLimit('maxAudioMinutes') as number,
    tier,
    isSignedIn: Boolean(user?.id),
  });

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

  useEffect(() => {
    // Wait for Clerk to finish loading so we never fetch history as 'guest'
    // when the real signed-in user is about to be resolved.
    if (!clerkLoaded) return;

    const userId = user?.id || 'guest';

    // When a real user signs in, claim any sermons they created as a guest
    // in this browser so they don't disappear from their library.
    if (user?.id) {
      claimGuestSermons(user.id).then(() =>
        getSermonHistory(userId).then(setHistory)
      );
    } else {
      getSermonHistory(userId).then(setHistory);
    }
  }, [user, clerkLoaded]);

  useEffect(() => { 
    // Check if first time user
    const hasOnboarded = localStorage.getItem('rhemanotes_onboarded');
    if (!hasOnboarded) setShowOnboarding(true);

    // Detect Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('session_id')) {
      setCheckoutSessionId(params.get('session_id'));
      setCurrentScreen('success');
      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('rhemanotes_onboarded', 'true');
    setShowOnboarding(false);
  };

  const handleProcessTranscript = useCallback(
    async (transcript: string, liveNotes?: UserNote[], file?: File) => {
      if (file) {
        await processAudioFile(file, 'live', liveNotes);
      } else {
        await processText(transcript, 'text', liveNotes);
      }
    },
    [processAudioFile, processText],
  );

  const handleProcessFile = useCallback(
    async (file: File) => {
      await processFileDirect(file, 'upload');
    },
    [processFileDirect],
  );

  const handleSelectSermon = useCallback((item: SermonHistoryItem) => {
    setSermonOutput(item.summary);
    setSelectedHistoryId(item.id);
    setCurrentScreen('summary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleToggleReflection = useCallback(() => setIncludeReflection(p => !p), []);

  /**
   * Called by SermonSummary after any in-place update (likes, journal, notes, etc.).
   * Applies the update optimistically to both sermonOutput and history state.
   * No D1 re-fetch — localforage is already updated by updateSermonInHistory,
   * and a background sync would risk overwriting the optimistic state.
   */
  const handleUpdateHistory = useCallback((updatedSummary?: SermonSummaryOutput) => {
    if (!updatedSummary) return;
    // Update sermonOutput regardless — the summary is the source of truth
    setSermonOutput(updatedSummary);
    // Update the matching history entry if we can find it
    setHistory(prev =>
      prev.map(h => h.summary.title === updatedSummary.title && selectedHistoryId
        ? h.id === selectedHistoryId ? { ...h, summary: updatedSummary } : h
        : h
      )
    );
  }, [selectedHistoryId]);

  const handleDeleteItem = async (id: string) => {
    const activeUserId = user?.id || 'guest';

    // Require a real signed-in user to delete — guests cannot delete anything.
    if (activeUserId === 'guest') {
      alert('Please sign in to delete sermon records.');
      return;
    }

    const target = history.find(i => i.id === id);
    // Block if the item belongs to a different real user
    if (target?.user_id && target.user_id !== 'guest' && target.user_id !== activeUserId) {
      alert('Only the creator of this sermon record is allowed to delete it.');
      return;
    }

    await deleteSermonFromHistory(id, activeUserId);
    setHistory(prev => prev.filter(i => i.id !== id));
    if (selectedHistoryId === id) {
      setCurrentScreen('history');
      setSermonOutput(null);
      setSelectedHistoryId(null);
    }
  };

  const handleLoadDemo = async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const savedItem = await saveSermonToHistory(DEMO_SERMON, user?.id || 'guest', 'text');
    setHistory((prev) => [savedItem, ...prev]);
    setSermonOutput(DEMO_SERMON);
    setSelectedHistoryId(savedItem.id);
    setCurrentScreen('summary');
  };

  const handleGoHome = useCallback(() => {
    setCurrentScreen('home');
    setSermonOutput(null);
    setSelectedHistoryId(null);
    setError(null);
    setIncludeReflection(false);
    setPageMeta(HOME_META);
  }, []);

  const handleManageSubscription = useCallback(() => {
    setCurrentScreen('pricing');
  }, []);

  const handleNavigate = useCallback((screen: AppScreen) => {
    setCurrentScreen(screen);
    if (screen === 'home') { setSermonOutput(null); setSelectedHistoryId(null); setPageMeta(HOME_META); }
    if (screen === 'history') setPageMeta(HISTORY_META);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      /* ── Home ── */
      case 'home':
        return (
          <div className="flex flex-col items-center space-y-24 py-12 animate-in fade-in duration-700">
            {/* Hero */}
            <div className="flex flex-col items-center text-center space-y-8 max-w-3xl">
              {/* Premium Hero Logo Showcase */}
              <div className="relative group mb-4">
                {/* Ambient multi-layered glowing backdrops */}
                <div className="absolute -inset-4 rounded-[3.5rem] bg-gradient-to-r from-indigo-500/20 via-rose-500/10 to-amber-500/20 blur-3xl opacity-80 animate-pulse duration-[8000ms] pointer-events-none" />
                <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-indigo-500/30 to-amber-400/20 blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                
                {/* Sleek spinning orbital gradient ring - always active for mobile, speeds up on hover! */}
                <div className="absolute -inset-1.5 rounded-[3rem] bg-gradient-to-r from-indigo-500/40 via-amber-400/50 to-rose-500/40 opacity-70 blur-[1px] animate-spin duration-[30000ms] group-hover:duration-[15000ms] pointer-events-none" />

                {/* Floating logo card with a dark bezel glass container - responsive to tactile mobile taps! */}
                <div className="relative p-2.5 rounded-[2.8rem] bg-white/40 dark:bg-indigo-950/40 backdrop-blur-md border border-white/80 dark:border-indigo-900/50 shadow-2xl transform transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1 active:scale-98 active:translate-y-0 z-10">
                  <div className="relative rounded-[2.2rem] overflow-hidden bg-indigo-950 p-1 border border-indigo-900/10 shadow-inner flex items-center justify-center">
                    <img 
                      src={logoImg} 
                      alt="RhemaNotes Logo" 
                      className="w-24 h-24 rounded-[2rem] transform transition-transform duration-700 hover:scale-110"
                    />
                  </div>
                </div>
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
                Record a sermon like a voice memo, upload audio, or paste a transcript — RhemaNotes transcribes the Word and turns it into scripture links, study tools, and reflections.
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

            <PendingSyncBanner />
            <PendingPartialTranscriptBanner
              onResume={(transcript) => {
                openTranscriptReview(transcript, 'upload');
              }}
            />

            <div className="w-full max-w-3xl mx-auto p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-sm text-indigo-900/70 font-serif italic text-center">
              <strong className="font-black not-italic text-indigo-950">Long sermons (45+ min):</strong>{' '}
              Phone Voice Memos → Upload → <strong className="not-italic">Paste Text</strong> is most reliable.
              Or use Live Recording / Transcribe Audio, review &amp; edit the text, then build your study guide.
            </div>

            {/* Input method grid */}
            <div className="w-full">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                  <InputCard
                    icon={Mic}
                    accent="rose"
                    title="Live Recording"
                    description="Record the sermon like a voice memo. We transcribe it, then build your study guide."
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
                    title="Transcribe Audio"
                    description="Upload a recording — get editable text first, then your study guide."
                    onClick={() => { setInitialUploadMode('transcribe'); setCurrentScreen('upload'); }}
                  />
                  <InputCard
                    icon={FileText}
                    accent="indigo"
                    title="Paste Text"
                    description="Already have a transcript? Best for hour-long sermons."
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
                    <span>View Dashboard</span>
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
            onTranscribeFile={transcribeOnlyFile}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
            error={error}
            initialMode={initialUploadMode}
            initialText={uploadDraftText}
            onInitialTextConsumed={() => setUploadDraftText('')}
          />
        );

      case 'youtube':
        return (
          <YouTubeProcessor
            onProcessUrl={async (url) => {
              setError(null);
              try {
                const ytResult = await getYouTubeTranscript(url);
                await processText(ytResult.transcript, 'youtube', undefined, {
                  title: ytResult.title || 'YouTube Sermon Study',
                });
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to process YouTube link.');
              }
            }}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
          />
        );

      case 'history':
        return (
          <>
            <PendingPartialTranscriptBanner
              onResume={(transcript) => openTranscriptReview(transcript, 'upload')}
            />
            <SermonHistory
            history={history}
            onSelectSermon={handleSelectSermon}
            onDeleteItem={handleDeleteItem}
            onGoHome={handleGoHome}
            onLoadDemo={handleLoadDemo}
            activeUserId={user?.id || 'guest'}
          />
          </>
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
            activeUserId={user?.id || 'guest'}
            creatorId={history.find(h => h.id === selectedHistoryId)?.user_id}
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
              }
            }}
          />
        );

      case 'success':
        return (
          <PaymentSuccess
            onGoHome={handleGoHome}
            sessionId={checkoutSessionId}
            onActivatePlan={(sessionId) => refreshTier({ sessionId: sessionId || undefined, forceStripeSync: true })}
          />
        );

      case 'terms':
        return <TermsOfService onBack={handleGoHome} />;

      case 'privacy':
        return <PrivacyPolicy onBack={handleGoHome} />;

      case 'profile':
        return (
          <UserProfile
            onBack={handleGoHome}
            tier={tier}
            tierSyncError={tierSyncError}
            onManageSubscription={handleManageSubscription}
            onRefreshPlan={() => refreshTier({ forceStripeSync: true })}
            savedScriptures={savedScriptures}
            onScripturesChange={() => setSavedScriptures(getSavedScriptures())}
            stats={{
              totalScribes: history.length,
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Layout onNavigate={handleNavigate} currentScreen={currentScreen} tier={tier}>
      {renderScreen()}

      <AnimatePresence>
        {isLoading && (
          <ProcessingOverlay
            processingStatus={processingStatus}
            onCancel={cancelActiveProcessing}
          />
        )}
      </AnimatePresence>

      {pendingReview && (
        <TranscriptReviewModal
          transcript={pendingReview.transcript}
          fileName={pendingReview.file?.name}
          onConfirm={confirmTranscriptReview}
          onSaveForLater={async (text) => {
            await saveTranscriptForLater(text);
            setUploadDraftText(text);
            setInitialUploadMode('text');
            setCurrentScreen('upload');
          }}
          onReRecord={() => {
            dismissTranscriptReview();
            setCurrentScreen(pendingReview.sourceType === 'live' ? 'listening' : 'upload');
          }}
          isLoading={isLoading}
        />
      )}

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

export default App;
