import React from 'react';
import { User } from 'lucide-react';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react';
import { isClerkConfigured } from '../services/runtimeConfig';

interface AuthNavProps {
  variant: 'desktop' | 'mobile';
  onNavigate: (screen: string) => void;
  currentScreen: string;
}

function AuthLoading({ variant }: { variant: 'desktop' | 'mobile' }) {
  if (variant === 'mobile') {
    return (
      <span className="px-3 py-1.5 text-xs font-bold text-indigo-400 animate-pulse">…</span>
    );
  }
  return <span className="px-4 py-2 text-sm font-bold text-indigo-400 animate-pulse">…</span>;
}

function AuthUnavailable({ variant }: { variant: 'desktop' | 'mobile' }) {
  if (variant === 'mobile') {
    return (
      <span className="px-2 text-[10px] font-bold text-rose-600 max-w-[88px] leading-tight text-center">
        Sign-in not configured
      </span>
    );
  }
  return (
    <span className="px-3 py-2 text-xs font-bold text-rose-600 max-w-[160px] leading-snug text-center">
      Sign-in unavailable — set CLERK_PUBLISHABLE_KEY on the Worker
    </span>
  );
}

export const AuthNav: React.FC<AuthNavProps> = ({ variant, onNavigate, currentScreen }) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isClerkConfigured()) {
    return <AuthUnavailable variant={variant} />;
  }

  if (!isLoaded) {
    return <AuthLoading variant={variant} />;
  }

  if (!isSignedIn) {
    if (variant === 'mobile') {
      return (
        <SignInButton mode="modal">
          <button className="px-3 py-1.5 text-xs font-black bg-indigo-950 text-amber-100 rounded-xl hover:bg-indigo-900 active:scale-95 transition-all shadow-md">
            Sign In
          </button>
        </SignInButton>
      );
    }

    return (
      <>
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
      </>
    );
  }

  if (variant === 'mobile') {
    return <UserButton />;
  }

  return (
    <div className="flex items-center bg-white/50 p-1.5 rounded-[20px] border border-indigo-50/50 shadow-sm space-x-1">
      <button
        onClick={() => onNavigate('profile')}
        className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
          currentScreen === 'profile'
            ? 'bg-amber-100 text-amber-900 shadow-sm'
            : 'text-indigo-900/50 hover:text-indigo-900 hover:bg-indigo-50/50'
        }`}
      >
        <User className={`w-4 h-4 ${currentScreen === 'profile' ? 'text-amber-600' : ''}`} />
        <span>Dashboard</span>
      </button>
      <div className="px-2">
        <UserButton />
      </div>
    </div>
  );
};
