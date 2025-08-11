// lib/authRole.ts
import { supabase } from '@/lib/supabaseClient';

type Role = 'developer' | 'evaluator';

export async function ensureProfile(selectedRole?: Role) {
  // must run client-side after a session exists
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'no-user' };

  // Do we already have a profile row?
  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (readErr) return { ok: false, reason: 'read-error', error: readErr };

  if (existing) {
    // Already has a profile row → don’t change role here
    return { ok: true, created: false, role: existing.role as Role };
  }

  // New user with no profile row yet
  // Prefer the role the user selected (on signup). If not provided, try user_metadata.role.
  const metaRole = (user.user_metadata as any)?.role as Role | undefined;
  const role: Role | undefined = selectedRole ?? metaRole;

  if (!role) {
    // We need them to choose a role (e.g., send them to /signup to pick)
    return { ok: false, reason: 'missing-role' };
  }

  const { error: insertErr } = await supabase
    .from('profiles')
    .insert({ id: user.id, role, full_name: '' });

  if (insertErr) return { ok: false, reason: 'insert-error', error: insertErr };

  return { ok: true, created: true, role };
}
