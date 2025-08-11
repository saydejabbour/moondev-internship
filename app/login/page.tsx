'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Role = 'developer' | 'evaluator';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  // read once, memoize so it doesn’t change every render
  const nextParam = useMemo(() => params.get('next') || '', [params]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // ---------- helpers --------------------------------------------------------

  const isSafeNext = (n: string) =>
    n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/http');

  const destinationFor = (role: Role, next?: string) =>
    isSafeNext(next || '')
      ? (next as string)
      : role === 'evaluator'
        ? '/dashboard/evaluate'
        : '/dashboard/submit';

  const getProfileRole = async (userId: string): Promise<Role | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) return null;
    return (data?.role as Role | undefined) ?? null;
  };

  const createProfileIfMissing = async (userId: string, roleFromMeta: Role) => {
    // Only insert when missing (do NOT overwrite existing role)
    const current = await getProfileRole(userId);
    if (current) return current;

    const { error } = await supabase
      .from('profiles')
      .insert({ id: userId, role: roleFromMeta, full_name: '' });

    if (error) throw error;
    return roleFromMeta;
  };

  // If already signed in, bounce immediately (and ensure profile exists)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      const metaRole = (user.user_metadata?.role as Role | undefined) ?? 'developer';
      const role = await createProfileIfMissing(user.id, metaRole);
      router.replace(destinationFor(role, nextParam));
    })().catch(() => {/* ignore on load */});
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- actions --------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = data.user!;
      // prefer profile role; if profile missing, fall back to metadata (set at signup)
      const metaRole = (user.user_metadata?.role as Role | undefined) ?? 'developer';
      let role = await getProfileRole(user.id);
      if (!role) {
        role = await createProfileIfMissing(user.id, metaRole);
      }

      router.replace(destinationFor(role, nextParam));
    } catch (e: any) {
      setErr(e?.message || 'Sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  const handleGithub = async () => {
    setErr('');
    setBusy(true);

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback${
            isSafeNext(nextParam) ? `?next=${encodeURIComponent(nextParam)}` : ''
          }`
        : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
    }
    // success path leaves the page; profile will be ensured on callback or on load
  };

  // ---------- UI -------------------------------------------------------------

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded bg-white p-6 shadow">
        <button
          type="button"
          onClick={handleGithub}
          disabled={busy}
          className="mb-4 flex w-full items-center justify-center rounded border border-gray-400 bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1-.01-1.97-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.73-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18.92-.26 1.9-.39 2.88-.39s1.96.13 2.88.39c2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.73.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.25 5.68.42.35.78 1.05.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.79.56C20.71 21.38 24 17.08 24 12 24 5.65 18.85.5 12 .5z"
            />
          </svg>
          Sign in with GitHub
        </button>

        <hr className="my-4" />

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Email address</label>
            <input
              type="email"
              className="w-full rounded border border-gray-300 px-4 py-2"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Your Password</label>
            <input
              type="password"
              className="w-full rounded border border-gray-300 px-4 py-2"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-green-600 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {err && <p className="text-sm text-red-500">{err}</p>}
        </form>

        <div className="mt-4 text-center text-sm">
          <a href="#" className="text-blue-600 hover:underline">
            Forgot your password?
          </a>
        </div>

        <div className="mt-2 text-center text-sm">
          <a href="/signup" className="text-blue-600 hover:underline">
            Don’t have an account? Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
