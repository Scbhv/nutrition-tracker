import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkPremium = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsPremium(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('premium_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      setIsPremium(!error && !!data);
    } catch {
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPremium();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkPremium();
    });

    return () => subscription.unsubscribe();
  }, [checkPremium]);

  const recheck = useCallback(() => {
    setLoading(true);
    checkPremium();
  }, [checkPremium]);

  return { isPremium, loading, recheck };
}
