import React, { useEffect, useState } from 'react';
import { CommunityPost } from '../types';
import { getCommunityFeed, getCommunityPost } from '../services/storageService';
import { PublicSummaryView } from './PublicSummaryView';
import { formatSpeakerLabel } from '../lib/speakerMeta';
import { BookOpen, ChevronLeft, Clock, Globe, Loader2, Sparkles, User, Waves } from 'lucide-react';

interface CommunityLibraryProps {
  onGoHome: () => void;
}

export const CommunityLibrary: React.FC<CommunityLibraryProps> = ({ onGoHome }) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selected, setSelected] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const feed = await getCommunityFeed();
        if (!cancelled) setPosts(feed);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the Community Library.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openPost = async (post: CommunityPost) => {
    setOpening(true);
    setError(null);
    try {
      const full = await getCommunityPost(post.id);
      setSelected(full);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this summary.');
    } finally {
      setOpening(false);
    }
  };

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="btn-sacred-ghost mb-8 inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-50 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Community
        </button>

        <div className="sacred-card p-8 md:p-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full">
              Community Summary
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-black text-indigo-950 tracking-tight mb-6">
            {selected.summary.title || selected.title}
          </h2>
          <PublicSummaryView summary={selected.summary} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Globe className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <h2 className="text-4xl font-serif font-black text-indigo-950 tracking-tight">Community Library</h2>
            <p className="text-indigo-900/40 font-serif italic">Published summaries — personal plans stay private</p>
          </div>
        </div>
        <button onClick={onGoHome} className="btn-sacred-ghost px-6 py-2 bg-white border border-indigo-50 shadow-sm whitespace-nowrap">
          ← Return
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-indigo-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading published summaries…
        </div>
      )}

      {error && (
        <p className="mb-6 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">{error}</p>
      )}

      {!loading && posts.length === 0 && (
        <div className="sacred-card p-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-[32px] flex items-center justify-center mb-6 shadow-inner">
            <Sparkles className="w-10 h-10 text-indigo-200" />
          </div>
          <h3 className="text-2xl font-serif font-black text-indigo-950 mb-3">No summaries published yet</h3>
          <p className="text-indigo-900/40 font-serif italic max-w-sm">
            When you publish a study guide, only the Summary appears here — never your Plan.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => {
          const speaker = formatSpeakerLabel(post.summary);
          return (
            <button
              key={post.id}
              type="button"
              disabled={opening}
              onClick={() => openPost(post)}
              className="w-full text-left group sacred-card sacred-card-hover px-8 py-6 flex items-center gap-6 border-l-4 border-l-transparent hover:border-l-amber-300"
            >
              {post.summary.hero_image ? (
                <img
                  src={post.summary.hero_image.dataUrl}
                  alt=""
                  className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-indigo-50"
                />
              ) : (
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-900 transition-all">
                  <BookOpen className="w-6 h-6 text-indigo-400 group-hover:text-amber-200 transition-colors" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-serif font-black text-indigo-950 truncate group-hover:text-indigo-700">
                  {post.summary.title || post.title || 'Untitled Summary'}
                </h3>
                {speaker && (
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mt-1 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    {speaker}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-indigo-900/30 uppercase tracking-widest mt-1.5">
                  <span className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
                  </span>
                  {post.summary.scriptures?.length > 0 && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                      {post.summary.scriptures.length} Scriptures
                    </span>
                  )}
                </div>
                {post.summary.main_topic && (
                  <p className="mt-2 text-sm text-indigo-900/50 font-serif italic line-clamp-2 flex items-start gap-1.5">
                    <Waves className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                    {post.summary.main_topic}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
