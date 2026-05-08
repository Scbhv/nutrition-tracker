import { supabase } from '@/integrations/supabase/client';

export const ADMIN_EMAILS = ['simonstechprojects@gmail.com'];

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.includes(email);
}
