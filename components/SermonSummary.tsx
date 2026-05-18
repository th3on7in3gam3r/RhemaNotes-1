import React, { useState, useCallback, useEffect } from 'react';
import { SermonSummaryOutput } from '../types';
import { Button } from './Button';
import { TranscriptTab } from './TranscriptTab';
import { ScripturesTab } from './ScripturesTab';
import { ApplyTab } from './ApplyTab';
import { NotesTab } from './NotesTab';
import { StudySystem } from './StudySystem';
import { BibleTab } from './BibleTab';
import { processSermonTranscript } from '../services/geminiService';
import { updateSermonInHistory } from '../services/storageService';
import { setPageMeta, buildSermonMeta } from '../services/seoService';
import { BookOpen, RefreshCw, CheckCircle2, Copy, Sparkles, MessageSquare, Book, ChevronRight, Waves, Heart, FileText } from 'lucide-react';
import { SermonChat } from './SermonChat';
import { motion, AnimatePresence } from 'motion/react';
import { useSubscription } from '../hooks/useSubscription';
import { Lock } from 'lucide-react';

interface SermonSummaryProps {
  summary: SermonSummaryOutput;
  onGoHome: () => void;
  includeReflection: boolean;
  onToggleReflection: () => void;
  isLoading: boolean;
  historyId?: string;
  onUpdateHistory?: () => void;
}

export const SermonSummary: React.FC<SermonSummaryProps> = ({
  summary, onGoHome, includeReflection, onToggleReflection, isLoading, historyId, onUpdateHistory,
}) => {
  const [sidebarView, setSidebarView] = useState<'chat' | 'bible'>('chat');
  const [currentSummary, setCurrentSummary] = useState<SermonSummaryOutput>(summary);
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [bibleInitialRef, setBibleInitialRef] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { isPro } = useSubscription();

  useEffect(() => { setCurrentSummary(summary); }, [summary]);

  useEffect(() => {
    setPageMeta(buildSermonMeta({
      id: historyId ?? 'preview',
      title: summary.title || 'Sermon Note',
      mainTopic: summary.main_topic || '',
      scriptureCount: summary.scriptures?.length ?? 0,
      timestamp: Date.now(),
    }));
  }, [summary.title, historyId]);

  useEffect(() => {
    if (currentSummary.audio_blob) {
      const url = URL.createObjectURL(currentSummary.audio_blob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [currentSummary.audio_blob]);

  const handleCopyText = async () => {
    try {
      const points = currentSummary.key_points.map((p, i) => `${i + 1}. ${p}`).join('\n');
      const apps = currentSummary.applications.map((a, i) => `- ${a}`).join('\n');
      const text = `${currentSummary.title}\n\nKey Points:\n${points}\n\nApplication:\n${apps}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleUpdateSummarization = useCallback(async (updated: SermonSummaryOutput) => {
    setCurrentSummary(updated);
    if (historyId) {
      await updateSermonInHistory(historyId, updated);
      onUpdateHistory?.();
    }
  }, [historyId, onUpdateHistory]);

  const openInBible = useCallback((reference: string) => {
    setBibleInitialRef(reference);
    setSidebarView('bible');
  }, []);

  const handleToggleReflectionAndReprocess = useCallback(async () => {
    onToggleReflection();
    setReflectionBusy(true);
    setReflectionError(null);
    try {
      const updated = await processSermonTranscript(currentSummary.clean_transcript, !includeReflection);
      handleUpdateSummarization({
        ...updated,
        user_notes: currentSummary.user_notes,
        personal_action_items: currentSummary.personal_action_items,
      });
    } catch (err: any) {
      setReflectionError(err.message || 'Failed to update reflection.');
      onToggleReflection();
    } finally {
      setReflectionBusy(false);
    }
  }, [currentSummary, includeReflection, onToggleReflection, handleUpdateSummarization]);

  const [activeResource, setActiveResource] = useState<'transcript' | 'notes' | 'study' | 'apply' | null>('notes');

  const renderResourceContent = () => {
    switch (activeResource) {
      case 'transcript': return <TranscriptTab summary={currentSummary} onUpdateSummary={handleUpdateSummarization} />;
      case 'notes':      return <NotesTab summary={currentSummary} onUpdateSummary={handleUpdateSummarization} onOpenInBible={openInBible} />;
      case 'study':      return <StudySystem summary={currentSummary} onUpdateSummary={handleUpdateSummarization} />;
      case 'apply':      return <ApplyTab summary={currentSummary} />;
      default:           return null;
    }
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700 max-w-[1500px] mx-auto">
      
      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col gap-8">
        
        {/* Sacred Manuscript Header */}
        <div className="sacred-card p-10 md:p-12 border-t-8 border-t-indigo-900 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
               <div className="px-3 py-1 bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-widest rounded-full">
                 Spirit-Led Insight
               </div>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-serif font-black text-indigo-950 tracking-tight mb-4 leading-tight">
              {currentSummary.title || 'Sermon Illumination'}
            </h2>
            
            <div className="flex flex-wrap items-center gap-6 text-indigo-900/50">
              <span className="flex items-center space-x-2 bg-indigo-50/50 px-4 py-2 rounded-2xl font-serif italic text-indigo-900">
                <Waves className="w-4 h-4 text-amber-400" />
                <span>{currentSummary.main_topic}</span>
              </span>
              
              {audioUrl && (
                <div className="flex items-center space-x-3 bg-white/50 backdrop-blur-sm p-1 pr-4 rounded-full border border-indigo-50 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center">
                     <RefreshCw className="w-4 h-4 text-amber-200" />
                  </div>
                  <audio controls className="h-8 max-w-[180px] opacity-70 hover:opacity-100 transition-opacity" src={audioUrl} />
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={handleCopyText}
            className="absolute top-10 right-10 flex items-center space-x-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/50 rounded-2xl text-sm font-black transition-all shadow-sm active:scale-95"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Preserved!' : 'Copy Notes'}</span>
          </button>

          {/* Decorative halo */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-100/30 rounded-full blur-[100px] pointer-events-none" />
        </div>

        {/* Study Portal */}
        <div className="sacred-card p-10 border border-indigo-50">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-serif font-black text-indigo-950">Study Resources</h3>
            <div className="h-px flex-grow bg-indigo-50 mx-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'notes', label: 'Structured Notes', desc: 'Divine breakdown and key truths' },
              { id: 'apply', label: 'Spiritual Application', desc: 'Walking the word in daily life' },
              { id: 'study', label: 'Illumination Tools', desc: 'Quizzes, Flashcards & Vision Map' },
              { id: 'transcript', label: 'Full Scroll', desc: 'The complete spoken word' },
            ].map(res => (
              <button 
                key={res.id} 
                onClick={() => {
                  if ((res.id === 'study' || res.id === 'chat') && !isPro) {
                    // Navigate to pricing if they click a locked feature
                    // In a more complex app, we'd pass a navigation prop
                    return; 
                  }
                  setActiveResource(activeResource === res.id ? null : res.id as any);
                }}
                className={`
                  flex items-center justify-between p-6 rounded-3xl border transition-all duration-300 text-left relative
                  ${activeResource === res.id 
                    ? 'bg-indigo-900 border-indigo-900 shadow-xl shadow-indigo-200' 
                    : 'bg-white border-indigo-50 hover:border-amber-200 hover:shadow-lg'}
                  ${(res.id === 'study' && !isPro) ? 'opacity-70 grayscale' : ''}
                `}
              >
                {res.id === 'study' && !isPro && (
                  <div className="absolute top-4 right-4 text-amber-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )}
                <div>
                  <p className={`text-lg font-serif font-black ${activeResource === res.id ? 'text-amber-100' : 'text-indigo-950'}`}>
                    {res.label}
                  </p>
                  <p className={`text-xs mt-1 ${activeResource === res.id ? 'text-amber-100/60' : 'text-indigo-900/40'}`}>
                    {res.desc}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${activeResource === res.id ? 'bg-amber-100/20' : 'bg-indigo-50'}`}>
                   <ChevronRight className={`w-5 h-5 ${activeResource === res.id ? 'text-amber-200' : 'text-indigo-300'}`} />
                </div>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {activeResource && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-8 p-8 bg-indigo-50/30 rounded-[32px] border border-indigo-100/50">
                  {renderResourceContent()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sacred Scriptures List */}
        <div className="sacred-card p-10 border border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center space-x-3 mb-6">
             <Book className="w-6 h-6 text-amber-500" />
             <h3 className="text-2xl font-serif font-black text-indigo-950">Scripture Foundation</h3>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {currentSummary.scriptures.map((scripture, i) => (
              <div key={i} className="group relative">
                <button
                  onClick={() => openInBible(scripture.reference)}
                  className="px-5 py-3 bg-white hover:bg-amber-100 text-indigo-950 border border-indigo-100 hover:border-amber-300 rounded-2xl text-sm font-serif font-bold italic transition-all hover:-translate-y-1 shadow-sm"
                >
                  {scripture.reference}
                </button>
                
                {/* Divine Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 p-4 bg-indigo-950 text-white rounded-2xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all z-[70] text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">Divine Meaning</p>
                  <p className="text-xs font-serif italic leading-relaxed text-amber-50">
                    "{scripture.plain_meaning}"
                  </p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-950 rotate-45 -mt-1.5" />
                </div>
              </div>
            ))}
            {currentSummary.scriptures.length === 0 && (
              <p className="text-lg text-indigo-900/30 font-serif italic">No scriptures detected in this journey.</p>
            )}
          </div>
        </div>

        {/* Reflection Journal Section */}
        <div className="sacred-card p-10 border-t-4 border-t-amber-400">
          <div className="flex items-center space-x-3 mb-8">
             <Heart className="w-6 h-6 text-rose-400" />
             <h3 className="text-2xl font-serif font-black text-indigo-950">Reflection Journal</h3>
          </div>
          
          <div className="space-y-6">
            <p className="text-indigo-900/40 font-serif italic mb-6 leading-relaxed">
              Use this space to record how the Spirit is speaking to you through this message.
            </p>
            
            <textarea 
              placeholder="What is your main takeaway for your life this week?"
              className="w-full min-h-[160px] p-6 bg-indigo-50/30 border-2 border-indigo-50 rounded-[32px] font-serif text-lg text-indigo-950 placeholder:text-indigo-900/20 focus:outline-none focus:border-amber-200 transition-all"
            />
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button className="btn-sacred-primary flex-1 py-4">
                 Save to Journal
              </button>
              <button className="btn-sacred-gold flex-1 py-4 flex items-center justify-center space-x-2">
                 <Sparkles className="w-4 h-4" />
                 <span>AI Guided Prompts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Share & Preserve Section */}
        <div className="sacred-card p-10 border border-indigo-50 bg-indigo-50/10">
          <h3 className="text-xl font-serif font-black text-indigo-950 mb-6">Preserve & Share</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'PDF Export', icon: FileText, color: 'indigo' },
              { label: 'Share Link', icon: MessageSquare, color: 'indigo' },
              { label: 'Instagram Story', icon: Sparkles, color: 'rose' },
              { label: 'Church Group', icon: Waves, color: 'indigo' },
            ].map((action, i) => (
              <button key={i} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-indigo-50 hover:border-amber-200 hover:-translate-y-1 transition-all group">
                <div className={`w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3 group-hover:bg-indigo-900 transition-colors`}>
                  <action.icon className="w-5 h-5 text-indigo-400 group-hover:text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-950/60 group-hover:text-indigo-950">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Reflection Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 pb-12">
          <label className="flex items-center space-x-4 group cursor-pointer">
            <button
              role="switch"
              aria-checked={includeReflection}
              onClick={handleToggleReflectionAndReprocess}
              disabled={reflectionBusy || isLoading}
              className={`
                relative w-14 h-8 rounded-full transition-all duration-500 focus:outline-none
                ${includeReflection ? 'bg-indigo-900 shadow-inner' : 'bg-indigo-100'}
                disabled:opacity-50
              `}
            >
              <span className={`
                absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-500 flex items-center justify-center
                ${includeReflection ? 'translate-x-6 rotate-12' : ''}
              `}>
                 <Sparkles className={`w-3.5 h-3.5 ${includeReflection ? 'text-amber-500' : 'text-indigo-200'}`} />
              </span>
            </button>
            <div className="flex flex-col">
               <span className="text-base font-serif font-black text-indigo-950">
                  AI Deep Reflection
               </span>
               <span className="text-xs text-indigo-900/40 font-bold uppercase tracking-widest">
                  {reflectionBusy ? 'Illuminating…' : 'Enhance Study Guide'}
               </span>
            </div>
          </label>
          
          <button onClick={onGoHome} className="btn-sacred-ghost px-8 py-3 bg-white shadow-sm border border-indigo-50">
            ← Return Home
          </button>
        </div>

      </div>

      {/* ── Sidebar (Chat & Bible) ── */}
      <div className="w-full lg:w-[460px] flex-shrink-0 flex flex-col gap-8">
        
        {/* Divine Sidebar Toggle */}
        <div className="flex bg-indigo-50/50 p-2 rounded-3xl border border-indigo-100 shadow-inner">
          <button
            onClick={() => setSidebarView('chat')}
            className={`
              flex-1 flex items-center justify-center space-x-2 py-4 text-sm font-black rounded-2xl transition-all duration-500
              ${sidebarView === 'chat' 
                ? 'bg-white text-indigo-900 shadow-xl shadow-indigo-100' 
                : 'text-indigo-900/40 hover:text-indigo-900'}
            `}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Study Chat</span>
          </button>
          <button
            onClick={() => setSidebarView('bible')}
            className={`
              flex-1 flex items-center justify-center space-x-2 py-4 text-sm font-black rounded-2xl transition-all duration-500
              ${sidebarView === 'bible' 
                ? 'bg-white text-indigo-900 shadow-xl shadow-indigo-100' 
                : 'text-indigo-900/40 hover:text-indigo-900'}
            `}
          >
            <Book className="w-4 h-4" />
            <span>Bible Reader</span>
          </button>
        </div>

        {/* Divine Content Container */}
        <div className="flex-1 bg-white rounded-[40px] border border-indigo-50 shadow-2xl shadow-indigo-100/50 overflow-hidden min-h-[700px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={sidebarView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full"
            >
              {sidebarView === 'chat' ? (
                isPro ? (
                  <SermonChat summary={currentSummary} onUpdateSummary={handleUpdateSummarization} />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                      <Lock className="w-8 h-8 text-amber-500" />
                    </div>
                    <h4 className="text-xl font-serif font-black text-indigo-950 mb-3">Divine Dialogue</h4>
                    <p className="text-sm text-indigo-900/40 font-serif italic mb-8">
                      Deepen your study by chatting with the sermon. This feature is reserved for our Pro members.
                    </p>
                    {/* Note: In a real app we'd trigger the pricing screen here */}
                  </div>
                )
              ) : (
                <BibleTab summary={currentSummary} onUpdateSummary={handleUpdateSummarization} initialReference={bibleInitialRef} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
};
