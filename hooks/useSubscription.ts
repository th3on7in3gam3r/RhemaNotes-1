import { useState, useEffect } from 'react';
import { useUser } from '@clerk/react';
import { UserTier, TIER_LIMITS, canUseFeature, FeatureLimits } from '../constants/features';
import { authFetch } from '../services/apiAuth';

export const useSubscription = () => {
  const { user, isLoaded } = useUser();
  const [tier, setTier] = useState<UserTier>('free');
  const [isLoadingTier, setIsLoadingTier] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setTier('free');
      setIsLoadingTier(false);
      return;
    }

    // Fetch real tier from DB
    const fetchTier = async () => {
      try {
        const res = await authFetch(`/api/user?userId=${user.id}`);
        if (res.ok) {
          const data = (await res.json()) as { tier: string };
          if (data.tier === 'pro' || data.tier === 'church' || data.tier === 'free') {
            setTier(data.tier as UserTier);
          }
        }
      } catch {
        // fallback to free on error
        setTier('free');
      } finally {
        setIsLoadingTier(false);
      }
    };

    fetchTier();
  }, [user, isLoaded]);

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
    isLoadingTier,
    checkFeature,
    getLimit,
    setTier,
  };
};
