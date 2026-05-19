import React, { useState, useCallback, useEffect } from 'react';
import { SermonSummaryOutput } from '../types';
import { Button } from './Button';
import { TranscriptTab } from './TranscriptTab';
import { ScripturesTab } from './ScripturesTab';
import { ApplyTab } from './ApplyTab';
import { NotesTab } from './NotesTab';
import { StudySystem } from './StudySystem';
import { BibleTab } from './BibleTab';
import { processSermonTranscript, generateGuidedPrompts } from '../services/geminiService';
import localforage from 'localforage';
import { updateSermonInHistory, saveScripture, removeSavedScripture, isScriptureSaved, getSavedScriptures } from '../services/storageService';
import { setPageMeta, buildSermonMeta } from '../services/seoService';
import { BookOpen, RefreshCw, CheckCircle2, Copy, Sparkles, MessageSquare, Book, ChevronRight, Waves, Heart, FileText, Bookmark } from 'lucide-react';
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
  /** Called after any in-place update. Receives the new summary so the parent
   *  can apply it optimistically without a D1 round-trip. */
  onUpdateHistory?: (updatedSummary: SermonSummaryOutput) => void;
  activeUserId?: string;
  creatorId?: string;
}

export const SermonSummary: React.FC<SermonSummaryProps> = ({
  summary, onGoHome, includeReflection, onToggleReflection, isLoading, historyId, onUpdateHistory,
  activeUserId, creatorId,
}) => {
  const [sidebarView, setSidebarView] = useState<'chat' | 'bible'>('chat');
  const [currentSummary, setCurrentSummary] = useState<SermonSummaryOutput>(summary);
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [bibleInitialRef, setBibleInitialRef] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { isPro } = useSubscription();

  // isCreator for likes & journal:
  // Only block when we KNOW the viewer is someone else (both IDs present and different).
  // If creatorId is missing (old records pre-dating the user_id field), default to allowed
  // so the actual owner is never locked out of their own notes.
  // The delete button has its own separate strict guard (positive match required).
  const isCreator = !(creatorId && activeUserId && creatorId !== activeUserId);

  const [journalText, setJournalText] = useState(summary.reflection?.reflection_text || '');
  const [guidedPrompts, setGuidedPrompts] = useState<string[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Track which scripture references have been saved this session
  const [savedRefs, setSavedRefs] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (historyId) {
      currentSummary.scriptures?.forEach(s => {
        if (isScriptureSaved(s.reference, historyId)) set.add(s.reference);
      });
    }
    return set;
  });

  const handleSaveScripture = (scripture: { reference: string; plain_meaning: string; speaker_usage: string }) => {
    if (!historyId) return;
    const alreadySaved = savedRefs.has(scripture.reference);
    if (alreadySaved) {
      const all = getSavedScriptures();
      const match = all.find(s => s.reference === scripture.reference && s.sermonId === historyId);
      if (match) removeSavedScripture(match.id);
      setSavedRefs(prev => { const next = new Set(prev); next.delete(scripture.reference); return next; });
    } else {
      saveScripture({
        reference: scripture.reference,
        plain_meaning: scripture.plain_meaning,
        speaker_usage: scripture.speaker_usage,
        sermonId: historyId,
        sermonTitle: currentSummary.title || 'Untitled Sermon',
      });
      setSavedRefs(prev => new Set(prev).add(scripture.reference));
    }
  };

  useEffect(() => { 
    setCurrentSummary(summary); 
    setJournalText(summary.reflection?.reflection_text || '');
  }, [summary]);

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
      const points = (currentSummary.key_points || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
      const apps = (currentSummary.applications || []).map((a, i) => `- ${a}`).join('\n');
      const text = `${currentSummary.title || ''}\n\nKey Points:\n${points}\n\nApplication:\n${apps}`;
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
      // Pass activeUserId so the backend can enforce creator-only writes
      await updateSermonInHistory(historyId, updated, activeUserId || 'guest');
      // Pass the updated summary directly so the parent can apply it
      // optimistically — no D1 re-fetch needed to keep the UI in sync.
      onUpdateHistory?.(updated);
    }
  }, [historyId, onUpdateHistory, activeUserId]);

  const openInBible = useCallback((reference: string) => {
    setBibleInitialRef(reference);
    setSidebarView('bible');
  }, []);

  const handleSaveJournal = useCallback(async () => {
    if (!isCreator) {
      alert("Only the creator of this sermon note is allowed to save journal entries.");
      return;
    }
    setSaveStatus('saving');
    try {
      const updated = {
        ...currentSummary,
        reflection: {
          ...currentSummary.reflection,
          reflection_text: journalText
        }
      };
      await handleUpdateSummarization(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error("Failed to save reflection journal:", err);
      setSaveStatus('idle');
    }
  }, [currentSummary, journalText, handleUpdateSummarization, isCreator]);

  const handleLoadGuidedPrompts = useCallback(async () => {
    setIsLoadingPrompts(true);
    try {
      const prompts = await generateGuidedPrompts(
        currentSummary.main_topic || currentSummary.title || '',
        currentSummary.key_points || []
      );
      setGuidedPrompts(prompts);
    } catch (err) {
      console.error("Failed to load AI guided prompts:", err);
    } finally {
      setIsLoadingPrompts(false);
    }
  }, [currentSummary]);

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
      case 'notes':      return <ApplyTab summary={currentSummary} />;
      case 'study':      return <StudySystem summary={currentSummary} onUpdateSummary={handleUpdateSummarization} />;
      case 'apply':      return <NotesTab summary={currentSummary} onUpdateSummary={handleUpdateSummarization} onOpenInBible={openInBible} />;
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
          
          <div className="absolute top-10 right-10 flex items-center space-x-3">
            {/* Copy Notes */}
            <button
              onClick={handleCopyText}
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/50 rounded-2xl text-sm font-black transition-all shadow-sm active:scale-95 dark:bg-amber-950 dark:border-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Preserved!' : 'Copy Notes'}</span>
            </button>
          </div>

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
            {currentSummary.scriptures.map((scripture, i) => {
              const saved = savedRefs.has(scripture.reference);
              return (
                <div key={i} className="group relative">
                  <div className="flex items-center gap-1 bg-white border border-indigo-100 hover:border-amber-300 rounded-2xl shadow-sm transition-all hover:-translate-y-0.5 overflow-hidden">
                    <button
                      onClick={() => openInBible(scripture.reference)}
                      className="px-4 py-3 text-sm font-serif font-bold italic text-indigo-950 hover:bg-amber-50 transition-colors"
                    >
                      {scripture.reference}
                    </button>
                    <button
                      onClick={() => handleSaveScripture(scripture)}
                      title={saved ? 'Remove from saved scriptures' : 'Save to your profile'}
                      className={`px-3 py-3 border-l transition-colors ${
                        saved
                          ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100'
                          : 'text-indigo-300 border-indigo-100 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 p-4 bg-indigo-950 text-white rounded-2xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all z-[70] text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">Divine Meaning</p>
                    <p className="text-xs font-serif italic leading-relaxed text-amber-50">
                      "{scripture.plain_meaning}"
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-950 rotate-45 -mt-1.5" />
                  </div>
                </div>
              );
            })}
            {currentSummary.scriptures.length === 0 && (
              <p className="text-lg text-indigo-900/30 font-serif italic">No scriptures detected in this journey.</p>
            )}
          </div>
          {savedRefs.size > 0 && (
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-amber-600">
              {savedRefs.size} scripture{savedRefs.size !== 1 ? 's' : ''} saved to your profile
            </p>
          )}
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

            {/* AI Deep Spiritual Insights Card / Loader */}
            {reflectionBusy && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-slate-800/60 dark:to-slate-900/40 border border-amber-100/50 dark:border-slate-800 rounded-3xl text-center space-y-3"
              >
                <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                <h4 className="font-serif font-black text-indigo-950 dark:text-white">Illuminating Deep Reflection...</h4>
                <p className="text-xs text-indigo-900/40 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Engaging scripture alignment, historical context, and generating a custom guided prayer to enrich your heart.
                </p>
              </motion.div>
            )}

            {!reflectionBusy && includeReflection && (currentSummary.reflection?.takeaway || currentSummary.reflection?.reflection_text || currentSummary.reflection?.prayer) && (
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 md:p-8 bg-gradient-to-br from-amber-50/50 to-orange-50/20 dark:from-slate-800/40 dark:to-slate-900/20 border border-amber-100/40 dark:border-slate-800 rounded-[32px] space-y-6 text-left"
              >
                <div className="flex items-center space-x-2.5">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  <h4 className="text-sm font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">AI Deep Spiritual Insights</h4>
                </div>

                {currentSummary.reflection.takeaway && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Core Devotional Takeaway</p>
                    <p className="font-serif italic text-base text-indigo-950 dark:text-slate-200 leading-relaxed">
                      "{currentSummary.reflection.takeaway}"
                    </p>
                  </div>
                )}

                {currentSummary.reflection.reflection_text && (
                  <div className="space-y-1 pt-2 border-t border-amber-100/40 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Deep Theological Context</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-serif">
                      {currentSummary.reflection.reflection_text}
                    </p>
                  </div>
                )}

                {currentSummary.reflection.prayer && (
                  <div className="space-y-1 pt-2 border-t border-amber-100/40 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Guided Prayer Response</p>
                    <p className="font-serif italic text-sm text-indigo-950/70 dark:text-slate-300 leading-relaxed bg-amber-50/30 dark:bg-slate-800/30 p-4 rounded-2xl border border-amber-100/30 dark:border-slate-800/40">
                      "{currentSummary.reflection.prayer}"
                    </p>
                  </div>
                )}
              </motion.div>
            )}
            
            {/* AI Guided Prompts List */}
            {guidedPrompts.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2 mb-4 text-left"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>AI Guided Reflections (Click to insert):</span>
                </p>
                <div className="grid gap-2.5">
                  {guidedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!isCreator) return;
                        setJournalText(prev => prev ? `${prev}\n\n* ${prompt}\n` : `* ${prompt}\n`);
                      }}
                      disabled={!isCreator}
                      className="w-full text-left p-3.5 bg-amber-50/40 hover:bg-amber-50 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-amber-100 dark:border-slate-800 rounded-2xl text-xs font-medium text-slate-700 dark:text-slate-300 transition-all hover:translate-x-0.5 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <textarea 
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              disabled={!isCreator}
              placeholder={!isCreator ? "Only the creator of this sermon note is allowed to save journal takeaways." : "What is your main takeaway for your life this week?"}
              className="w-full min-h-[160px] p-6 bg-indigo-50/30 border-2 border-indigo-50 dark:border-slate-800 rounded-[32px] font-serif text-lg text-indigo-950 dark:text-white placeholder:text-indigo-900/20 focus:outline-none focus:border-amber-200 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
            />
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={handleSaveJournal}
                disabled={saveStatus === 'saving' || !isCreator}
                className="btn-sacred-primary flex-1 py-4 font-black transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                 <span>
                    {!isCreator 
                      ? 'Read-Only Journal'
                      : saveStatus === 'saving' 
                      ? 'Saving...' 
                      : saveStatus === 'saved' 
                      ? 'Journal Saved! ✓' 
                      : 'Save to Journal'}
                 </span>
              </button>
              <button 
                onClick={handleLoadGuidedPrompts}
                disabled={isLoadingPrompts || !isCreator}
                className="btn-sacred-gold flex-1 py-4 flex items-center justify-center space-x-2 font-black transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                 {isLoadingPrompts ? (
                   <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
                 ) : (
                   <Sparkles className="w-4 h-4" />
                 )}
                 <span>{isLoadingPrompts ? 'Generating...' : 'AI Guided Prompts'}</span>
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
          <div 
            onClick={!reflectionBusy && !isLoading ? handleToggleReflectionAndReprocess : undefined}
            className="flex items-center space-x-4 group cursor-pointer select-none"
          >
            <div
              className={`
                relative w-14 h-8 rounded-full transition-all duration-500 focus:outline-none
                ${includeReflection ? 'bg-indigo-900 shadow-inner' : 'bg-indigo-100'}
                ${reflectionBusy || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span className={`
                absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-500 flex items-center justify-center
                ${includeReflection ? 'translate-x-6 rotate-12' : ''}
              `}>
                 <Sparkles className={`w-3.5 h-3.5 ${includeReflection ? 'text-amber-500' : 'text-indigo-200'}`} />
              </span>
            </div>
            <div className="flex flex-col text-left">
               <span className="text-base font-serif font-black text-indigo-950 dark:text-white group-hover:text-amber-500 transition-colors">
                  AI Deep Reflection
               </span>
               <span className="text-xs text-indigo-900/40 dark:text-slate-400 font-bold uppercase tracking-widest">
                  {reflectionBusy ? 'Illuminating…' : includeReflection ? 'Study Guide Enhanced ✓' : 'Enhance Study Guide'}
               </span>
            </div>
          </div>
          
          <button onClick={onGoHome} className="btn-sacred-ghost px-8 py-3 bg-white shadow-sm border border-indigo-50">
            ← Return Home
          </button>
        </div>

      </div>

      {/* ── Sidebar (Chat & Bible) ── */}
      <div className="w-full lg:w-[460px] flex-shrink-0 flex flex-col gap-6 lg:self-start lg:sticky lg:top-32 z-30">
        
        {/* Divine Sidebar Toggle */}
        <div className="flex bg-indigo-50/50 dark:bg-slate-800 p-2 rounded-3xl border border-indigo-100 dark:border-slate-800 shadow-inner">
          <button
            onClick={() => setSidebarView('chat')}
            className={`
              flex-1 flex items-center justify-center space-x-2 py-4 text-sm font-black rounded-2xl transition-all duration-500
              ${sidebarView === 'chat' 
                ? 'bg-white dark:bg-slate-900 text-indigo-900 dark:text-white shadow-xl shadow-indigo-100 dark:shadow-none' 
                : 'text-indigo-900/40 dark:text-slate-400 hover:text-indigo-900 dark:hover:text-white'}
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
                ? 'bg-white dark:bg-slate-900 text-indigo-900 dark:text-white shadow-xl shadow-indigo-100 dark:shadow-none' 
                : 'text-indigo-900/40 dark:text-slate-400 hover:text-indigo-900 dark:hover:text-white'}
            `}
          >
            <Book className="w-4 h-4" />
            <span>Bible Reader</span>
          </button>
        </div>

        {/* Divine Content Container */}
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-indigo-50 dark:border-slate-800 shadow-2xl shadow-indigo-100/50 dark:shadow-none overflow-hidden h-[580px] flex flex-col">
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
