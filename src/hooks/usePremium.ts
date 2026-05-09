import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/errorLog';

/**
 * Premium status hook.
 *
 * Persistence guarantees:
 *  - Premium is stored server-side in `premium_users` (the source of truth).
 *  - We cache the LAST KNOWN premium=true result per user in localStorage so a
 *    returning user sees premium UI instantly on app open, before the network
 *    confirmation lands.
 *  - On a transient network/DB error we DO NOT downgrade an already-premium
 *    session to free; we keep the cached value and retry.
 *  - We only clear premium when:
 *      (a) the user signs out, or
 *      (b) the server explicitly confirms no row exists for them.
 */

const CACHE_PREFIX = 'nutritrack-premium:';

function readCache(userId: string): boolean {
  try {
    return localStorage.getItem(CACHE_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

function writeCache(userId: string, value: boolean) {
  try {
    if (value) localStorage.setItem(CACHE_PREFIX + userId, '1');
    else localStorage.removeItem(CACHE_PREFIX + userId);
  } catch {
    /* storage disabled — ignore */
  }
}

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  const checkPremium = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        currentUserIdRef.current = null;
        setIsPremium(false);
        setLoading(false);
        return;
      }

      currentUserIdRef.current = user.id;

      // 1. Fast path — show cached premium immediately while we revalidate.
      const cached = readCache(user.id);
      if (cached) setIsPremium(true);

      // 2. Source of truth: ask the server.
      const { data, error } = await supabase
        .from('premium_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        // Network / RLS / transient error — keep cached value, do NOT downgrade.
        logError('Premium', error, 'Failed to verify premium status; keeping cached value.');
        setIsPremium(cached);
        return;
      }

      // 3. Server-confirmed truth → update state + cache.
      const confirmed = !!data;
      setIsPremium(confirmed);
      writeCache(user.id, confirmed);
    } catch (err) {
      logError('Premium', err, 'Unexpected error checking premium.');
      // Don't change state on unexpected error.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Synchronous bootstrap: if we have a cached uid+premium, render premium
    // immediately so there's no "free" flash.
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
      if (keys.some(k => localStorage.getItem(k) === '1')) {
        setIsPremium(true);
      }
    } catch { /* ignore */ }

    checkPremium();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null;
        setIsPremium(false);
        setLoading(false);
        return;
      }
      // SIGNED_IN, INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED → recheck.
      if (session?.user) {
        // Show cached premium right away on a known device.
        const cached = readCache(session.user.id);
        if (cached) setIsPremium(true);
      }
      checkPremium();
    });

    return () => subscription.unsubscribe();
  }, [checkPremium]);

  const recheck = useCallback(async () => {
    setLoading(true);
    await checkPremium();
  }, [checkPremium]);

  return { isPremium, loading, recheck };
}
