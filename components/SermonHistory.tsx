import React from 'react';
import { SermonHistoryItem } from '../types';
import { Button } from './Button';
import { BookOpen, ChevronRight, Trash2, Clock, BookMarked, Sparkles, Waves, Heart } from 'lucide-react';

interface SermonHistoryProps {
  history: SermonHistoryItem[];
  onSelectSermon: (item: SermonHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onGoHome: () => void;
  onLoadDemo: () => void;
  activeUserId?: string;
}

export const SermonHistory: React.FC<SermonHistoryProps> = ({
  history, onSelectSermon, onDeleteItem, onGoHome, onLoadDemo, activeUserId
}) => {
  const [search, setSearch] = React.useState('');
  const fmt = (ts: number) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));

  const filteredHistory = history.filter(item => 
    (item.summary.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.summary.main_topic || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
        <div className="flex items-center space-x-4">
           <div className="w-12 h-12 bg-indigo-900 rounded-2xl flex items-center justify-center shadow-lg">
              <Waves className="w-6 h-6 text-amber-200" />
           </div>
           <div>
             <h2 className="text-4xl font-serif font-black text-indigo-950 tracking-tight">User Dashboard</h2>
             <p className="text-indigo-900/40 font-serif italic">Review your spiritual journey</p>
           </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
             <input 
               type="text" 
               placeholder="Search wisdom..."
               value={search}
               onChange={e => setSearch(e.target.value)}
               className="w-full pl-12 pr-4 py-2.5 bg-white border border-indigo-50 rounded-2xl font-serif text-indigo-950 focus:outline-none focus:border-amber-200 shadow-sm"
             />
             <Sparkles className="absolute left-4 top-3 w-4 h-4 text-indigo-200" />
          </div>
          <button onClick={onGoHome} className="btn-sacred-ghost px-6 py-2 bg-white border border-indigo-50 shadow-sm whitespace-nowrap">
            ← Return
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="sacred-card p-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-[32px] flex items-center justify-center mb-6 shadow-inner">
            <BookMarked className="w-10 h-10 text-indigo-200" />
          </div>
          <h3 className="text-2xl font-serif font-black text-indigo-950 mb-3">No sermons preserved yet</h3>
          <p className="text-indigo-900/40 font-serif italic mb-8 max-w-sm">Capture your first sermon to begin building your personal archive of wisdom.</p>
          <div className="flex items-center space-x-4">
            <button onClick={onGoHome} className="btn-sacred-ghost">Go back</button>
            <button onClick={onLoadDemo} className="btn-sacred-gold shadow-lg">
              <Sparkles className="w-4 h-4" />
              <span>Explore Demo Sermon</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map(item => (
            <div
              key={item.id}
              onClick={() => onSelectSermon(item)}
              className="
                group sacred-card sacred-card-hover px-8 py-6 cursor-pointer
                flex items-center justify-between gap-6 border-l-4 border-l-transparent hover:border-l-amber-300
              "
            >
              <div className="flex items-center space-x-6 min-w-0">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-900 transition-all duration-500">
                  <BookOpen className="w-6 h-6 text-indigo-400 group-hover:text-amber-200 transition-colors" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-serif font-black text-indigo-950 truncate group-hover:text-indigo-700 transition-colors flex items-center gap-2">
                    <span>{item.summary.title || 'Untitled Sermon'}</span>
                    {item.summary.liked && (
                      <Heart className="w-4 h-4 text-rose-500 fill-current animate-pulse flex-shrink-0" />
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-y-1 text-xs font-bold text-indigo-900/30 uppercase tracking-widest mt-1.5">
                    <span className="flex items-center">
                       <Clock className="w-3.5 h-3.5 mr-1.5" />
                       {fmt(item.timestamp)}
                    </span>
                    <span className="mx-2 hidden sm:inline">·</span>
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">{item.summary.scriptures.length} Scriptures</span>
                    <span className="mx-2 hidden sm:inline">·</span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">{item.summary.key_points.length} Insights</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {(!item.user_id || !activeUserId || item.user_id === activeUserId) && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to remove this sermon study guide from your library? (This will not delete or affect any actual scriptures or Bible verses.)')) onDeleteItem(item.id);
                    }}
                    className="p-3 text-indigo-200 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-xl"
                    title="Remove sermon summary from library"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="w-10 h-10 rounded-full border border-indigo-50 flex items-center justify-center group-hover:border-amber-200 transition-colors">
                   <ChevronRight className="w-5 h-5 text-indigo-200 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
