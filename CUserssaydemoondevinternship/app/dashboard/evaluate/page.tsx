'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRoleRedirect } from '@/hooks/useRoleRedirect';

type Decision = 'accepted' | 'rejected';

interface Submission {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  hobby: string | null;
  profile_picture: string | null; // object key in 'uploads' bucket
  zip_file: string | null;        // object key in 'uploads' bucket
  feedback: string | null;
  status: string | null;
  created_at?: string | null;
}

export default function EvaluatePage() {
  const checking = useRoleRedirect('evaluator');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  // initial load
  useEffect(() => {
    if (checking) return;

    const fetchSubmissions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) setError(error.message);
      else setSubmissions((data ?? []) as Submission[]);
      setLoading(false);
    };

    fetchSubmissions();
  }, [checking]);

  // realtime sync
  useEffect(() => {
    if (checking) return;

    const channel = supabase
      .channel('submissions-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSubmissions((prev) => [payload.new as Submission, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSubmissions((prev) =>
              prev.map((s) =>
                s.id === (payload.new as Submission).id
                  ? (payload.new as Submission)
                  : s
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setSubmissions((prev) =>
              prev.filter((s) => s.id !== (payload.old as Submission).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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


  // save decision + send email via API route (same-origin; no CORS headaches)
  const handleDecision = async (id: number, decision: Decision) => {
    const current = submissions.find((s) => s.id === id);
    if (!current) return;

    const feedback = current.feedback ?? '';

    setSaving((p) => ({ ...p, [id]: true }));

    // 1) update DB (realtime will refresh UI)
    const { error: updateErr } = await supabase
      .from('submissions')
      .update({ status: decision, feedback })
      .eq('id', id);

    if (updateErr) {
      setSaving((p) => ({ ...p, [id]: false }));
      alert(`Failed to save: ${updateErr.message}`);
      return;
    }

    // 2) call API route that forwards to your Edge Function
    const resp = await fetch('/api/send-eval-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: current.email,
        fullName: current.full_name,
        status: decision,
        feedback,
      }),
    });

    setSaving((p) => ({ ...p, [id]: false }));

    if (!resp.ok) {
      const msg = await resp.text().catch(() => '');
      console.error('Email failed:', resp.status, msg);
      alert('Decision saved, but email failed. Check function logs.');
    }
  };

  const onFeedbackChange = (id: number, text: string) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, feedback: text } : s))
    );
  };

  if (checking) return <p className="mt-10 text-center">Loading…</p>;

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <h1 className="mb-6 text-3xl font-bold">Evaluate Developer Submissions</h1>

      {loading && <p>Loading submissions…</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && submissions.length === 0 && <p>No submissions yet.</p>}

      <div className="space-y-6">
        {submissions.map((sub) => (
          <SubmissionCard
            key={sub.id}
            sub={sub}
            getSignedUrl={getSignedUrl}
            onFeedbackChange={onFeedbackChange}
            onDecision={handleDecision}
            saving={!!saving[sub.id]}
          />
        ))}
      </div>
    </div>
  );
}

function SubmissionCard({
  sub,
  getSignedUrl,
  onFeedbackChange,
  onDecision,
  saving,
}: {
  sub: Submission;
  getSignedUrl: (p: string | null) => Promise<string | null>;
  onFeedbackChange: (id: number, text: string) => void;
  onDecision: (id: number, d: Decision) => void;
  saving: boolean;
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
    return () => {
      cancelled = true;
    };
  }, [sub.profile_picture, sub.zip_file, getSignedUrl]);

  return (
    <div className="rounded border bg-white p-4 shadow">
      <h2 className="mb-2 text-xl font-bold">{sub.full_name}</h2>
      <p><strong>Email:</strong> {sub.email}</p>
      <p><strong>Phone:</strong> {sub.phone}</p>
      <p><strong>Location:</strong> {sub.location}</p>
      <p><strong>Hobby:</strong> {sub.hobby}</p>

      <div className="my-2 space-x-4">
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

      <textarea
        className="mb-2 w-full rounded border px-4 py-2"
        placeholder="Write feedback here…"
        value={sub.feedback ?? ''}
        onChange={(e) => onFeedbackChange(sub.id, e.target.value)}
      />

      <div className="space-x-4">
        <button
          disabled={saving}
          onClick={() => onDecision(sub.id, 'accepted')}
          className={`rounded px-4 py-2 text-white ${saving ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {saving ? 'Saving…' : 'Welcome to the Team'}
        </button>
        <button
          disabled={saving}
          onClick={() => onDecision(sub.id, 'rejected')}
          className={`rounded px-4 py-2 text-white ${saving ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'}`}
        >
          {saving ? 'Saving…' : 'We Are Sorry'}
        </button>
      </div>

      {sub.status && (
        <p className="mt-2 text-sm">
          <strong>Status:</strong> {sub.status}
        </p>
      )}
    </div>
  );
}
