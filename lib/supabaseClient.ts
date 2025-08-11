import { createClient } from '@supabase/supabase-js';

export const supabase = (() => {
  // Singleton: evaluate once
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();
