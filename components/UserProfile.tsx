import React from 'react';
import { useUser, useClerk } from '@clerk/react';
import { 
  User, 
  Mail, 
  Calendar, 
  Crown, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  Sparkles, 
  BookOpen, 
  Heart,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfileProps {
  onBack: () => void;
  tier: string;
  stats: {
    totalScribes: number;
    favorites: number;
  };
  onManageSubscription: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ 
  onBack, tier, stats, onManageSubscription 
}) => {
  const { user } = useUser();
  const { signOut } = useClerk();

  if (!user) return (
    <div className="max-w-md mx-auto text-center py-20">
      <h2 className="text-3xl font-serif font-black text-indigo-950 mb-4">Join the Sanctuary</h2>
      <p className="text-indigo-900/60 mb-8">Sign in to preserve your spiritual journey and unlock deep reflections.</p>
      <button onClick={onBack} className="btn-sacred-primary px-10 py-4">Return Home</button>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12"
    >
      {/* ── Sacred Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16 gap-6 md:gap-8">
        <div className="space-y-4">
           <button onClick={onBack} className="group text-indigo-900/50 hover:text-indigo-950 font-black text-[10px] uppercase tracking-[0.2em] flex items-center transition-all w-fit">
             <div className="w-8 h-8 rounded-full bg-white border border-indigo-100 flex items-center justify-center mr-3 group-hover:bg-indigo-50 group-hover:-translate-x-1 transition-all">
               <ChevronLeft className="w-4 h-4" />
             </div>
             Return to Home
           </button>
           <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-black text-indigo-950 tracking-tight leading-none">
             Your Sanctuary
           </h1>
           <p className="text-indigo-900/50 font-serif italic text-base md:text-lg">A sacred space for your spiritual growth</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[24px] md:rounded-[32px] shadow-sm border border-indigo-50 w-full md:w-auto">
           <div className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-indigo-50/50 rounded-2xl text-indigo-900 text-[10px] font-black uppercase tracking-widest flex items-center justify-center">
              <ShieldCheck className="w-3 h-3 mr-2 text-emerald-500" />
              Protected
           </div>
           <button onClick={() => signOut()} className="flex-1 md:flex-none px-4 py-3 md:py-2 hover:bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center">
              <LogOut className="w-3 h-3 mr-2" />
              Sign Out
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        {/* ── Left Column: Identity Card ── */}
        <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-32 h-fit">
           <motion.div 
             whileHover={{ y: -4 }}
             className="bg-white rounded-[32px] md:rounded-[48px] p-8 md:p-12 shadow-2xl shadow-indigo-100/50 border border-indigo-50 relative overflow-hidden group"
           >
              <div className="absolute top-0 inset-x-0 h-32 md:h-40 bg-gradient-to-b from-indigo-950 to-indigo-900" />
              
              <div className="relative z-10 flex flex-col items-center">
                 <div className="relative mb-8">
                    <div className="absolute inset-0 bg-amber-400 rounded-[44px] rotate-6 group-hover:rotate-12 transition-transform duration-700" />
                    <img 
                      src={user.imageUrl} 
                      alt={user.fullName || 'User'} 
                      className="relative w-32 h-32 rounded-[40px] border-4 border-white shadow-2xl object-cover"
                    />
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl border-2 border-indigo-50">
                       <Crown className="w-6 h-6 text-amber-500" />
                    </div>
                 </div>

                 <h2 className="text-3xl font-serif font-black text-indigo-950 mb-2">
                   {user.fullName}
                 </h2>
                 <p className="text-indigo-900/30 text-xs font-black uppercase tracking-[0.2em] mb-10">
                   Member since {new Date(user.createdAt!).getFullYear()}
                 </p>

                 <div className="w-full space-y-4">
                    <div className="p-6 bg-indigo-50/50 rounded-[32px] border border-indigo-50/50 text-center">
                       <p className="text-[10px] font-black text-indigo-900/30 uppercase tracking-[0.3em] mb-2">Current Tier</p>
                       <span className={`text-2xl font-serif font-black italic ${tier === 'free' ? 'text-indigo-400' : 'text-amber-600'}`}>
                         {tier === 'free' ? 'The Mustard Seed' : tier === 'pro' ? 'The Vine Member' : 'The Harvest Church'}
                       </span>
                    </div>

                    {tier === 'free' && (
                      <button 
                        onClick={onManageSubscription}
                        className="group relative w-full overflow-hidden py-5 md:py-6 bg-indigo-950 text-amber-200 rounded-[24px] md:rounded-[32px] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:shadow-2xl hover:shadow-indigo-900/30 hover:-translate-y-1 active:scale-[0.98] transition-all"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-amber-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        <span className="flex items-center justify-center">
                          <Zap className="w-4 h-4 mr-2" />
                          Upgrade to Pro
                        </span>
                      </button>
                    )}
                    
                    <button 
                      onClick={onManageSubscription}
                      className="w-full py-4 md:py-5 bg-white border-2 border-indigo-50 text-indigo-950 rounded-[24px] md:rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all"
                    >
                      Manage Billing
                    </button>
                 </div>
              </div>
           </motion.div>

           <motion.div 
             whileHover={{ scale: 1.02 }}
             className="p-8 md:p-10 bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-[32px] md:rounded-[48px] text-white shadow-xl relative overflow-hidden"
           >
              <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10">
                 <Sparkles className="w-24 h-24" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-300 mb-6">Spiritual Pulse</h4>
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-3">
                       <span>Faith Retention</span>
                       <span className="text-amber-400">88%</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-400 rounded-full w-[88%]" />
                    </div>
                 </div>
                 <p className="text-sm text-indigo-100/60 leading-relaxed font-serif italic">
                   "Your word I have hidden in my heart, that I might not sin against You." — Psalm 119:11
                 </p>
              </div>
           </motion.div>
        </div>

        {/* ── Right Column: Stats & Insight ── */}
        <div className="lg:col-span-8 space-y-8 md:space-y-12">
           {/* Big Stats Grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white rounded-[32px] md:rounded-[48px] p-8 md:p-12 border border-indigo-50 shadow-lg flex flex-col justify-between"
              >
                 <div className="w-14 h-14 md:w-16 md:h-16 bg-indigo-50 rounded-[20px] md:rounded-3xl flex items-center justify-center mb-8 md:mb-10">
                    <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
                 </div>
                 <div>
                    <h4 className="text-5xl md:text-6xl font-serif font-black text-indigo-950 mb-2">{stats.totalScribes}</h4>
                    <p className="text-indigo-900/50 text-[10px] md:text-xs font-black uppercase tracking-[0.3em]">Total Scribes</p>
                 </div>
              </motion.div>
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white rounded-[32px] md:rounded-[48px] p-8 md:p-12 border border-indigo-50 shadow-lg flex flex-col justify-between"
              >
                 <div className="w-14 h-14 md:w-16 md:h-16 bg-rose-50 rounded-[20px] md:rounded-3xl flex items-center justify-center mb-8 md:mb-10">
                    <Heart className="w-6 h-6 md:w-8 md:h-8 text-rose-500" />
                 </div>
                 <div>
                    <h4 className="text-5xl md:text-6xl font-serif font-black text-indigo-950 mb-2">{stats.favorites}</h4>
                    <p className="text-indigo-900/50 text-[10px] md:text-xs font-black uppercase tracking-[0.3em]">Favorite Sermons</p>
                 </div>
              </motion.div>
           </div>

           {/* Personal Info & Security */}
           <motion.div 
             initial={{ opacity: 0 }}
             whileInView={{ opacity: 1 }}
             viewport={{ once: true }}
             className="bg-white rounded-[32px] md:rounded-[56px] p-8 md:p-12 border border-indigo-50 shadow-xl space-y-8 md:space-y-10"
           >
              <h3 className="text-xl md:text-2xl font-serif font-black text-indigo-950 flex items-center">
                 <ShieldCheck className="w-6 h-6 text-indigo-300 mr-3 hidden sm:block" />
                 Identity & Security
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                 <div className="p-6 md:p-8 bg-indigo-50/50 hover:bg-indigo-50 transition-colors rounded-[24px] md:rounded-[32px] border border-indigo-50">
                    <span className="text-[9px] md:text-[10px] font-black text-indigo-900/40 uppercase tracking-[0.2em] block mb-3 md:mb-4">Email Address</span>
                    <div className="flex items-center text-indigo-950 font-bold text-sm md:text-base truncate">
                       <Mail className="w-4 h-4 mr-2 md:mr-3 text-indigo-300 flex-shrink-0" />
                       <span className="truncate">{user.primaryEmailAddress?.emailAddress}</span>
                    </div>
                 </div>
                 <div className="p-6 md:p-8 bg-indigo-50/50 hover:bg-indigo-50 transition-colors rounded-[24px] md:rounded-[32px] border border-indigo-50">
                    <span className="text-[9px] md:text-[10px] font-black text-indigo-900/40 uppercase tracking-[0.2em] block mb-3 md:mb-4">Account Type</span>
                    <div className="flex items-center text-indigo-950 font-bold text-sm md:text-base uppercase tracking-widest">
                       <Calendar className="w-4 h-4 mr-2 md:mr-3 text-indigo-300 flex-shrink-0" />
                       Personal Archive
                    </div>
                 </div>
              </div>

              <div className="pt-8 md:pt-10 border-t border-indigo-50">
                 <div className="flex items-start md:items-center space-x-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-950 rounded-[20px] flex items-center justify-center flex-shrink-0 shadow-inner">
                       <Settings className="w-5 h-5 md:w-6 md:h-6 text-amber-300" />
                    </div>
                    <div>
                       <h5 className="text-xs md:text-sm font-black text-indigo-950 uppercase tracking-widest mb-1">Data Preservation</h5>
                       <p className="text-[10px] md:text-xs text-indigo-900/50 font-medium leading-relaxed">Your data is encrypted and securely backed up across distributed cloud nodes.</p>
                    </div>
                 </div>
              </div>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="p-8 md:p-12 bg-gradient-to-br from-amber-50 via-white to-amber-50/50 rounded-[32px] md:rounded-[56px] border border-amber-100 shadow-xl text-center relative overflow-hidden"
           >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
              <div className="relative z-10">
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-amber-500 mx-auto mb-6" />
                <h4 className="text-lg md:text-xl font-serif font-black text-amber-950 mb-4 tracking-tight">You are part of the Harvest.</h4>
                <p className="text-amber-900/70 max-w-lg mx-auto font-serif italic text-base md:text-lg leading-relaxed">
                  "Let us not grow weary while doing good, for in due season we shall reap if we do not lose heart."
                  <br/>
                  <span className="block mt-4 text-xs font-sans font-black uppercase tracking-[0.2em] text-amber-600/60">— Galatians 6:9</span>
                </p>
              </div>
           </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
