import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const PUBLIC_ROUTES = new Set([
  '/login', '/signup', '/auth/callback', '/not-authorized', '/'
]);

export function useRoleRedirect(required?: 'developer' | 'evaluator') {
  const pathname = usePathname();
  const router   = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Skip checks on public routes
      if (PUBLIC_ROUTES.has(pathname)) { 
        if (alive) setChecking(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      // basic role gate only when a role is required
      if (!required) { setChecking(false); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const role = (prof?.role as 'developer' | 'evaluator' | undefined) ?? 'developer';
      if (required !== role) {
        router.replace('/not-authorized');
        return;
      }

      setChecking(false);
    })();

    return () => { alive = false; };
  }, [pathname, required, router]);

  return checking;
}
