// lib/authRole.ts
import { supabase } from '@/lib/supabaseClient';

export type Role = 'developer' | 'evaluator';

type EnsureProfileResult =
  | { ok: true; created: boolean; role: Role }
  | { ok: false; reason: 'no-user' | 'missing-role' | 'read-error' | 'insert-error'; error?: unknown };

export async function ensureProfile(selectedRole?: Role): Promise<EnsureProfileResult> {
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
    return { ok: true, created: false, role: existing.role as Role };
  }

  // New user: prefer an explicit selection, otherwise fall back to metadata
  const metaRole = (user.user_metadata?.role as Role | undefined);
  const role = selectedRole ?? metaRole;
  if (!role) return { ok: false, reason: 'missing-role' };

  const { error: insertErr } = await supabase
    .from('profiles')
    .insert({ id: user.id, role, full_name: '' });

  if (insertErr) return { ok: false, reason: 'insert-error', error: insertErr };

  return { ok: true, created: true, role };
}
