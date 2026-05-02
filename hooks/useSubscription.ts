import { useState, useEffect } from 'react';
import { UserTier, TIER_LIMITS, canUseFeature, FeatureLimits } from '../constants/features';
import { useUser } from '@clerk/react';

export const useSubscription = () => {
  const { user } = useUser();
  const [tier, setTier] = useState<UserTier>('free');

  useEffect(() => {
    // Override for user as requested
    if (user?.primaryEmailAddress?.emailAddress === 'jerlessm@gmail.com') {
      setTier('church');
    }
  }, [user]);

  const checkFeature = (feature: keyof FeatureLimits) => {
    return canUseFeature(tier, feature);
  };

  const getLimit = (feature: keyof FeatureLimits) => {
    return TIER_LIMITS[tier][feature];
  };

  return {
    tier,
    isPro: tier === 'pro' || tier === 'church',
    isChurch: tier === 'church',
    checkFeature,
    getLimit,
    setTier,
  };
};
