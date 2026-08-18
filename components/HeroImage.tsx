import React, { useEffect, useRef, useState } from 'react';
import { HeroImage, ImagePlacement } from '../types';
import { compressImageFile } from '../lib/compressImage';
import { ImagePlus, Trash2, X } from 'lucide-react';

interface HeroImageBlockProps {
  image?: HeroImage;
  children?: React.ReactNode;
  className?: string;
}

export const HeroImageBlock: React.FC<HeroImageBlockProps> = ({ image, children, className = '' }) => {
  if (!image) {
    return <div className={className}>{children}</div>;
  }

  const placement = image.placement || 'top';
  const isTop = placement === 'top';

  return (
    <div className={className}>
      {isTop && (
        <ClickableHeroImage
          src={image.dataUrl}
          wrapperClassName="block w-full mb-6"
          imgClassName="w-full max-h-80 object-cover rounded-2xl border border-indigo-50 shadow-sm cursor-zoom-in"
        />
      )}
      {!isTop && (
        <ClickableHeroImage
          src={image.dataUrl}
          wrapperClassName={`block w-[46%] max-w-sm mb-3 ${
            placement === 'left' ? 'float-left mr-5' : 'float-right ml-5'
          }`}
          imgClassName="w-full max-h-64 object-cover rounded-2xl border border-indigo-50 shadow-sm cursor-zoom-in"
        />
      )}
      {children}
      {!isTop && <div className="clear-both" />}
    </div>
  );
};

interface ClickableHeroImageProps {
  src: string;
  wrapperClassName?: string;
  imgClassName: string;
}

const ClickableHeroImage: React.FC<ClickableHeroImageProps> = ({ src, wrapperClassName = '', imgClassName }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`p-0 border-0 bg-transparent ${wrapperClassName}`}>
        <img src={src} alt="Sermon cover" className={imgClassName} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-indigo-950/85 backdrop-blur-xl"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged sermon image"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={src}
            alt="Sermon cover enlarged"
            className="max-w-[92vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

interface HeroImageEditorProps {
  image?: HeroImage;
  disabled?: boolean;
  onChange: (image: HeroImage | undefined) => void;
}

const PLACEMENT_OPTIONS: { id: ImagePlacement; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

export const HeroImageEditor: React.FC<HeroImageEditorProps> = ({ image, disabled, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await compressImageFile(file);
      onChange({ dataUrl, placement: image?.placement || 'top' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="sacred-card p-6 border border-indigo-50">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-serif font-black text-indigo-950">Cover image</h3>
          <p className="text-xs text-indigo-900/40 font-medium">
            Place it at the top, left, or right of your Summary. Click the image to enlarge.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-indigo-100 text-sm font-bold text-indigo-800 hover:border-amber-200 disabled:opacity-50"
        >
          <ImagePlus className="w-4 h-4" />
          {busy ? 'Compressing…' : image ? 'Replace image' : 'Upload image'}
        </button>

        {image && (
          <>
            <div className="flex items-center rounded-xl border border-indigo-50 overflow-hidden">
              {PLACEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...image, placement: opt.id })}
                  className={`px-3 py-2 text-xs font-black uppercase tracking-widest ${
                    image.placement === opt.id
                      ? 'bg-indigo-900 text-white'
                      : 'bg-white text-indigo-900/50 hover:bg-indigo-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
};
