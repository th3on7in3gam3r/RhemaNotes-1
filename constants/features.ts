export type UserTier = 'free' | 'pro' | 'church';

export interface FeatureLimits {
  summariesPerMonth: number;
  maxAudioMinutes: number;
  youtubeProcessing: boolean;
  aiChat: boolean;
  advancedStudy: boolean; // Quizzes, Flashcards
  customPrompts: boolean;
  cloudSync: boolean;
  scriptureContext: boolean; // Greek/Hebrew
  exportFormats: ('pdf' | 'notion' | 'logos')[];
}

export const TIER_LIMITS: Record<UserTier, FeatureLimits> = {
  free: {
    summariesPerMonth: 3,
    maxAudioMinutes: 30,
    youtubeProcessing: false,
    aiChat: false,
    advancedStudy: false,
    customPrompts: false,
    cloudSync: false,
    scriptureContext: false,
    exportFormats: ['pdf'],
  },
  pro: {
    summariesPerMonth: Infinity,
    maxAudioMinutes: 120,
    youtubeProcessing: true,
    aiChat: true,
    advancedStudy: true,
    customPrompts: true,
    cloudSync: true,
    scriptureContext: true,
    exportFormats: ['pdf', 'notion', 'logos'],
  },
  church: {
    summariesPerMonth: Infinity,
    maxAudioMinutes: 180,
    youtubeProcessing: true,
    aiChat: true,
    advancedStudy: true,
    customPrompts: true,
    cloudSync: true,
    scriptureContext: true,
    exportFormats: ['pdf', 'notion', 'logos'],
  },
};

export const canUseFeature = (tier: UserTier, feature: keyof FeatureLimits): boolean => {
  const limit = TIER_LIMITS[tier][feature];
  if (typeof limit === 'boolean') return limit;
  if (Array.isArray(limit)) return limit.length > 0;
  return limit > 0;
};
