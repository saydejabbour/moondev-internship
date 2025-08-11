'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRoleRedirect } from '@/hooks/useRoleRedirect';

interface Submission {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  hobby: string | null;
  profile_picture: string | null;
  zip_file: string | null;
  feedback: string | null;
  status: string | null;
  created_at?: string | null;
}

export default function ViewPage() {
  const checking = useRoleRedirect('developer');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (checking) return;

    const load = async () => {
      setLoading(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (authErr || !userId) {
        setError('User not authenticated.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) setError(error.message);
      else setSubmission((data ?? null) as Submission | null);

      setLoading(false);
    };

    load();
  }, [checking]);

  // Public-only helper: normalize key and return public URL (no signing)
const getSignedUrl = async (path: string | null) => {
  if (!path) return null;

  // normalize anything stored in DB to a clean object key
  const key = String(path)
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/uploads\//, '')
    .replace(/^public\/uploads\//, '')
    .replace(/^uploads\//, '')
    .replace(/^\//, '');

  if (!key) return null;

  const { data } = supabase.storage.from('uploads').getPublicUrl(key);
  return data?.publicUrl ?? null;
};


  if (checking) return <p className="mt-10 text-center">Loading…</p>;
  if (loading) return <p className="mt-10 text-center">Loading your submission…</p>;
  if (error) return <p className="mt-10 text-center text-red-500">{error}</p>;
  if (!submission) return <p className="mt-10 text-center">You haven’t submitted anything yet.</p>;

  return (
    <SubmissionDetails sub={submission} getSignedUrl={getSignedUrl} />
  );
}

function SubmissionDetails({
  sub,
  getSignedUrl,
}: {
  sub: Submission;
  getSignedUrl: (p: string | null) => Promise<string | null>;
}) {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getSignedUrl(sub.profile_picture);
      const z = await getSignedUrl(sub.zip_file);
      if (!cancelled) {
        setProfileUrl(p);
        setZipUrl(z);
      }
    })();
    return () => { cancelled = true; };
  }, [sub.profile_picture, sub.zip_file, getSignedUrl]);

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 border rounded shadow bg-white">
      <h2 className="text-2xl font-bold mb-4">My Submission</h2>

      <div className="space-y-2">
        <p><strong>Full Name:</strong> {sub.full_name}</p>
        <p><strong>Email:</strong> {sub.email}</p>
        <p><strong>Phone:</strong> {sub.phone}</p>
        <p><strong>Location:</strong> {sub.location}</p>
        <p><strong>Hobby:</strong> {sub.hobby}</p>
        {sub.status && (
          <p><strong>Status:</strong> {sub.status}</p>
        )}
        {sub.feedback && (
          <p><strong>Evaluator Feedback:</strong> {sub.feedback}</p>
        )}
      </div>

      <div className="my-4 space-x-4">
        {profileUrl ? (
          <a href={profileUrl} className="underline text-blue-600" target="_blank" rel="noopener noreferrer">
            View Profile Picture
          </a>
        ) : (
          <span className="text-gray-500">Profile picture not available</span>
        )}
        {zipUrl ? (
          <a href={zipUrl} className="underline text-blue-600" target="_blank" rel="noopener noreferrer">
            Download Source Code
          </a>
        ) : (
          <span className="text-gray-500">Zip not available</span>
        )}
      </div>
    </div>
  );
}
