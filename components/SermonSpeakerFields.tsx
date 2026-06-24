import React from 'react';
import { User } from 'lucide-react';
import { SPEAKER_TITLE_OPTIONS, type SermonSpeakerInput } from '../lib/speakerMeta';

interface SermonSpeakerFieldsProps {
  value: SermonSpeakerInput;
  onChange: (value: SermonSpeakerInput) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const SermonSpeakerFields: React.FC<SermonSpeakerFieldsProps> = ({
  value,
  onChange,
  disabled,
  compact,
}) => {
  const titleIsPreset =
    !value.speakerTitle ||
    (SPEAKER_TITLE_OPTIONS as readonly string[]).includes(value.speakerTitle);
  const selectValue = titleIsPreset ? value.speakerTitle : 'Other';
  const customTitle = titleIsPreset ? '' : value.speakerTitle;

  const handleTitleChange = (next: string) => {
    if (next === 'Other') {
      onChange({ ...value, speakerTitle: customTitle || '' });
      return;
    }
    onChange({ ...value, speakerTitle: next });
  };

  return (
    <div
      className={`rounded-2xl border border-indigo-100 bg-indigo-50/40 ${
        compact ? 'p-4 mb-6' : 'p-5 mb-8'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-indigo-500" />
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
          Preacher / speaker <span className="font-serif normal-case tracking-normal text-indigo-400">(optional)</span>
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="speaker-title" className="sr-only">
            Title or role
          </label>
          <select
            id="speaker-title"
            value={selectValue}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={disabled}
            className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
          >
            {SPEAKER_TITLE_OPTIONS.map((opt) => (
              <option key={opt || 'none'} value={opt}>
                {opt || 'Title / role…'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="speaker-name" className="sr-only">
            Name
          </label>
          <input
            id="speaker-name"
            type="text"
            value={value.preacherName}
            onChange={(e) => onChange({ ...value, preacherName: e.target.value })}
            disabled={disabled}
            placeholder="e.g. John Smith"
            className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl text-sm font-serif text-indigo-950 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
          />
        </div>
      </div>
      {selectValue === 'Other' && (
        <input
          type="text"
          value={customTitle}
          onChange={(e) => onChange({ ...value, speakerTitle: e.target.value })}
          disabled={disabled}
          placeholder="Custom title (e.g. Apostle, Chaplain)"
          className="mt-3 w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl text-sm font-serif text-indigo-950 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
        />
      )}
    </div>
  );
};
