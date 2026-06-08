import React from 'react';
import { Bookmark } from 'lucide-react';

interface ScriptureSaveButtonProps {
  saved: boolean;
  onClick: () => void;
  showLabel?: boolean;
  className?: string;
}

export const ScriptureSaveButton: React.FC<ScriptureSaveButtonProps> = ({
  saved,
  onClick,
  showLabel = true,
  className = '',
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title={saved ? 'Remove from Saved Scriptures on your profile' : 'Save to Saved Scriptures on your profile'}
    className={`
      inline-flex items-center gap-1.5 font-black uppercase tracking-wider transition-colors
      ${showLabel ? 'px-3 py-2 text-[10px] rounded-xl' : 'p-2 rounded-lg'}
      ${saved
        ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
        : 'text-indigo-600 bg-white border border-indigo-100 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200'}
      ${className}
    `}
  >
    <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-current' : ''}`} />
    {showLabel && <span>{saved ? 'Saved' : 'Save'}</span>}
  </button>
);
