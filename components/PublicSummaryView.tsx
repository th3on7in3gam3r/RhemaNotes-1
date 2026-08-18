import React from 'react';
import { PublicSummary } from '../types';
import { HeroImageBlock } from './HeroImage';
import { formatSpeakerLabel } from '../lib/speakerMeta';
import { Book, Quote, Target, User, Zap } from 'lucide-react';

const Section: React.FC<{
  icon: React.ElementType;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, iconColor, title, children }) => (
  <div>
    <div className="flex items-center space-x-2 mb-4">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h4>
    </div>
    {children}
  </div>
);

/** Read-only Summary for the Community Library — never renders Plan fields. */
export const PublicSummaryView: React.FC<{ summary: PublicSummary }> = ({ summary }) => {
  const speaker = formatSpeakerLabel(summary);

  return (
    <HeroImageBlock image={summary.hero_image} className="space-y-8">
      {speaker && (
        <Section icon={User} iconColor="text-amber-500" title="Sermon Info">
          <p className="text-slate-700 dark:text-slate-300">
            <span className="font-bold">Speaker / Pastor:</span> {speaker}
          </p>
        </Section>
      )}

      {summary.scriptures?.length > 0 && (
        <Section icon={Book} iconColor="text-amber-600" title="Scripture References">
          <ul className="space-y-2">
            {summary.scriptures.map((s, i) => (
              <li key={`${s.reference}-${i}`} className="text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-bold">{s.reference}</span>
                {s.plain_meaning ? ` — ${s.plain_meaning}` : ''}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.main_topic && (
        <Section icon={Target} iconColor="text-blue-500" title="Central Message">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{summary.main_topic}</p>
        </Section>
      )}

      {summary.key_points?.length > 0 && (
        <Section icon={Zap} iconColor="text-amber-500" title="Key Points">
          <ol className="space-y-2 list-decimal list-inside">
            {summary.key_points.map((point, i) => (
              <li key={i} className="text-slate-700 dark:text-slate-300 leading-relaxed">{point}</li>
            ))}
          </ol>
        </Section>
      )}

      {summary.quotes?.length > 0 && (
        <Section icon={Quote} iconColor="text-indigo-500" title="Notable Quotes">
          <div className="space-y-3">
            {summary.quotes.map((quote, i) => (
              <blockquote
                key={i}
                className="border-l-4 border-indigo-300 dark:border-indigo-700 pl-4 py-1 italic text-slate-600 dark:text-slate-400"
              >
                &ldquo;{quote}&rdquo;
              </blockquote>
            ))}
          </div>
        </Section>
      )}

      {summary.applications?.length > 0 && (
        <Section icon={Target} iconColor="text-emerald-500" title="Application">
          <ul className="space-y-2">
            {summary.applications.map((app, i) => (
              <li key={i} className="flex items-start space-x-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{app}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </HeroImageBlock>
  );
};
