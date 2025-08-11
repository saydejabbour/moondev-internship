'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/user'; // create this file next

export default function SubmissionForm() {
  const supabase = createClientComponentClient<Database>();
  const [projectUrl, setProjectUrl] = useState('');
  const [score, setScore] = useState<number | ''>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('submissions').insert({
      user_id: user?.id,
      project_url: projectUrl,
      score: typeof score === 'number' ? score : null,
    });

    if (error) {
      alert('Submission failed: ' + error.message);
    } else {
      alert('Project submitted!');
      setProjectUrl('');
      setScore('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="url"
        placeholder="Project URL"
        value={projectUrl}
        onChange={(e) => setProjectUrl(e.target.value)}
        required
        className="border p-2 w-full"
      />
      <input
        type="number"
        placeholder="Score (optional)"
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
        className="border p-2 w-full"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit
      </button>
    </form>
  );
}
