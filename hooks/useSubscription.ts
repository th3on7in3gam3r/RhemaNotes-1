import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/react';
import { UserTier, TIER_LIMITS, canUseFeature, FeatureLimits } from '../constants/features';
import { authFetch } from '../services/apiAuth';

async function fetchTierFromApi(userId: string): Promise<UserTier> {
  const res = await authFetch(`/api/user?userId=${userId}`);
  if (!res.ok) return 'free';
  const data = (await res.json()) as { tier: string };
  if (data.tier === 'pro' || data.tier === 'church' || data.tier === 'free') {
    return data.tier as UserTier;
  }
  return 'free';
}

async function syncSubscriptionFromStripe(
  userId: string,
  email: string,
  sessionId?: string,
): Promise<UserTier | null> {
  const res = await authFetch('/api/sync-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, sessionId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { tier: string };
  if (data.tier === 'pro' || data.tier === 'church' || data.tier === 'free') {
    return data.tier as UserTier;
  }
  return null;
}

export const useSubscription = () => {
  const { user, isLoaded } = useUser();
  const [tier, setTier] = useState<UserTier>('free');
  const [isLoadingTier, setIsLoadingTier] = useState(true);

  const refreshTier = useCallback(
    async (opts?: { sessionId?: string; forceStripeSync?: boolean }) => {
      if (!user) {
        setTier('free');
        return 'free' as UserTier;
      }

      setIsLoadingTier(true);
      try {
        let next = await fetchTierFromApi(user.id);
        if (opts?.sessionId || opts?.forceStripeSync || next === 'free') {
          const synced = await syncSubscriptionFromStripe(
            user.id,
            user.primaryEmailAddress?.emailAddress || '',
            opts?.sessionId,
          );
          if (synced) next = synced;
          else if (opts?.sessionId) next = await fetchTierFromApi(user.id);
        }
        setTier(next);
        return next;
      } catch {
        setTier('free');
        return 'free' as UserTier;
      } finally {
        setIsLoadingTier(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setTier('free');
      setIsLoadingTier(false);
      return;
    }

    void refreshTier();
  }, [user, isLoaded, refreshTier]);

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
    refreshTier,
  };
};
