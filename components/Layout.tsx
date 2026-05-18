import React, { useState, useEffect } from 'react';
import { History, Home, BookOpen, Moon, Sun, Sparkles, MessageCircle, Heart, Crown } from 'lucide-react';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import logoImg from '../logo.png';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (screen: any) => void;
  currentScreen: string;
  tier?: 'free' | 'pro' | 'church';
}

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentScreen, tier = 'free' }) => {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false,
  );
  const [scrolled, setScrolled] = useState(false);

  // Persist theme
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ss-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ss-theme', 'light');
    }
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem('ss-theme');
    if (saved === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navBtn = (screen: string, label: string, Icon: React.ElementType, mobileOnly = false) => {
    const active = currentScreen === screen;
    return (
      <button
        onClick={() => onNavigate(screen)}
        className={`
          relative flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-sm font-bold
          transition-all duration-300
          ${active
            ? 'text-indigo-900 bg-amber-100 shadow-sm'
            : 'text-indigo-900/50 hover:text-indigo-900 hover:bg-indigo-50/50'
          }
          ${mobileOnly ? 'md:hidden' : ''}
        `}
      >
        <Icon className={`w-4 h-4 ${active ? 'text-amber-600' : ''}`} />
        <span className={mobileOnly ? '' : 'hidden lg:inline'}>{label}</span>
      </button>
    );
  };

  const mobileNavBtn = (screen: string, label: string, Icon: React.ElementType) => {
    const active = currentScreen === screen;
    return (
      <button
        onClick={() => onNavigate(screen)}
        className="flex flex-col items-center justify-center space-y-1 group relative"
      >
        <div className={`
          p-2 rounded-xl transition-all duration-300
          ${active ? 'bg-amber-100 text-amber-600 scale-110 shadow-sm' : 'text-indigo-900/40'}
        `}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${active ? 'text-indigo-950' : 'text-indigo-900/30'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-parchment)] transition-colors duration-500 font-sans">
      {/* ── Sacred Header ── */}
      <header
        className={`
          fixed top-0 left-0 right-0 z-50
          transition-all duration-500 ease-in-out
          ${scrolled 
            ? 'py-2 bg-white/80 backdrop-blur-xl shadow-lg border-b border-indigo-100' 
            : 'py-4 bg-transparent'}
        `}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Brand */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center space-x-3 group"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md border border-indigo-100/50 bg-indigo-950 flex items-center justify-center transform transition-all duration-300 group-hover:scale-105 group-hover:rotate-6 active:scale-95 active:rotate-0">
                <img 
                  src={logoImg} 
                  alt="RhemaNotes Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <span className="text-xl font-serif font-extrabold tracking-tight text-indigo-950">
              RhemaNotes
            </span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center bg-white/50 p-1.5 rounded-[20px] border border-indigo-50/50 shadow-sm">
            {navBtn('home',    'Home',    Home)}
            {navBtn('history', 'Library', History)}
            {/* Show Upgrade only for free users; pro/church get a tier badge */}
            {tier === 'free' && navBtn('pricing', 'Upgrade', Sparkles)}
            {tier === 'pro' && (
              <button
                onClick={() => onNavigate('pricing')}
                className="relative flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-bold bg-indigo-900 text-amber-200 shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="hidden lg:inline">The Vine ✓</span>
              </button>
            )}
            {tier === 'church' && (
              <button
                onClick={() => onNavigate('pricing')}
                className="relative flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-bold bg-amber-400 text-amber-950 shadow-sm"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden lg:inline">The Harvest ✓</span>
              </button>
            )}

            <div className="w-px h-5 bg-indigo-100 mx-2" />

            <button
              onClick={() => setDark(d => !d)}
              className="p-2.5 rounded-xl text-indigo-900/40 hover:text-indigo-900 hover:bg-indigo-50 transition-all"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="w-px h-5 bg-indigo-100 mx-2" />

            {/* Clerk Auth */}
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm font-bold text-indigo-900/60 hover:text-indigo-900 hover:bg-indigo-50 rounded-xl transition-all">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="ml-1 px-4 py-2 text-sm font-bold bg-indigo-900 text-amber-100 rounded-xl hover:bg-indigo-800 transition-all">
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </nav>

          {/* Mobile Theme Toggle only */}
          <div className="md:hidden">
            <button
              onClick={() => setDark(d => !d)}
              className="p-2.5 rounded-xl text-indigo-900/40 hover:text-indigo-900 bg-white/50 border border-indigo-50 shadow-sm"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Spacer for fixed header ── */}
      <div className="h-24 md:h-28" />

      {/* ── Main Content ── */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-6 pb-32 md:pb-20">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-[60]">
        <nav className="bg-white/90 backdrop-blur-2xl border border-indigo-100/50 shadow-2xl rounded-[32px] p-4 flex items-center justify-around">
          {mobileNavBtn('home', 'Home', Home)}
          {mobileNavBtn('history', 'Library', History)}
          {/* Center FAB — Start Scribing a Sermon */}
          <div className="relative -top-8 flex flex-col items-center">
            <button 
              onClick={() => onNavigate('new')}
              className="w-16 h-16 bg-indigo-950 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-200 border-2 border-amber-200/20 active:scale-95 transition-all"
            >
               <BookOpen className="w-7 h-7 text-amber-200" />
            </button>
            <span className="text-[9px] font-black uppercase tracking-tighter text-indigo-900/40 mt-1">Scribe</span>
          </div>
          {tier === 'free' ? mobileNavBtn('pricing', 'Upgrade', Sparkles) : (
            <button onClick={() => onNavigate('pricing')} className="flex flex-col items-center justify-center space-y-1">
              <div className="p-2 rounded-xl text-amber-500">
                <Crown className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter text-amber-500">Plan</span>
            </button>
          )}
          {mobileNavBtn('summary', 'Prayer', Heart)}
        </nav>
      </div>

      {/* ── Floating Feedback Button ── */}
      <div className="hidden md:block fixed bottom-8 right-8 z-[60]">
         <button
           onClick={() => window.open('mailto:feedback@rhemanotes.com?subject=Prayer%20%26%20Feedback&body=Hello%2C%20I%20wanted%20to%20share...', '_blank')}
           className="group relative flex items-center space-x-3 bg-white hover:bg-indigo-950 text-indigo-950 hover:text-white px-6 py-3 rounded-full shadow-xl border border-indigo-50 transition-all duration-500 hover:-translate-y-1"
         >
            <div className="w-8 h-8 rounded-full bg-indigo-50 group-hover:bg-amber-400/20 flex items-center justify-center transition-colors">
               <MessageCircle className="w-4 h-4 text-indigo-400 group-hover:text-amber-200" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Share Prayer &amp; Feedback</span>
         </button>
      </div>

      {/* ── Divine Footer ── */}
      <footer className="py-12 border-t border-indigo-50 bg-white/50 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center space-x-2 mb-2 text-indigo-900/60 font-serif font-bold italic">
             <BookOpen className="w-4 h-4" />
             <span>RhemaNotes</span>
          </div>
          <p className="text-xs text-indigo-900/40 font-medium">
            Capture the spirit of every sermon. Built for your spiritual growth.
          </p>
          <p className="text-xs text-indigo-900/30 mt-3">
            A product by{' '}
            <a
              href="https://biblefunland.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-900/50 hover:text-indigo-900 font-semibold underline underline-offset-2 transition-colors"
            >
              BibleFunLand.com
            </a>
          </p>
          <div className="flex items-center justify-center space-x-4 mt-4">
            <button
              onClick={() => onNavigate('terms')}
              className="text-xs text-indigo-900/30 hover:text-indigo-900/60 underline underline-offset-2 transition-colors"
            >
              Terms of Service
            </button>
            <span className="text-indigo-900/20">·</span>
            <button
              onClick={() => onNavigate('privacy')}
              className="text-xs text-indigo-900/30 hover:text-indigo-900/60 underline underline-offset-2 transition-colors"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
