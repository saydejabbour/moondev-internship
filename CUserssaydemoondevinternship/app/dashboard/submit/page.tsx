'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useRoleRedirect } from '@/hooks/useRoleRedirect';

// tiny helper: compress + resize image to <=1080px and try to keep under 1MB
async function compressImage(file: File, maxDim = 1080, targetBytes = 1024 * 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.92;
  let blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality));
  while (blob.size > targetBytes && quality > 0.4) {
    quality -= 0.08;
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality));
  }
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export default function SubmitPage() {
  const checking = useRoleRedirect('developer');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [hobby, setHobby] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [sourceCodeZip, setSourceCodeZip] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const picRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  if (checking) return <p className="mt-10 text-center">Loading…</p>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!profilePic || !sourceCodeZip) {
      setError('Please upload both profile picture and source code.');
      return;
    }
    if (sourceCodeZip.type !== 'application/zip' && !sourceCodeZip.name.toLowerCase().endsWith('.zip')) {
      setError('Source code must be a zip file.');
      return;
    }

    setSubmitting(true);
    try {
      // compress/resize if needed (ensures <=1080px and ~<=1MB)
      let picToUpload = profilePic;
      if (profilePic.size > 1024 * 1024) {
        picToUpload = await compressImage(profilePic);
      }

      const timestamp = Date.now();
      const profilePicExt = picToUpload.name.split('.').pop() || 'jpg';
      const profilePicPath = `profile-pics/${timestamp}.${profilePicExt}`;
      const zipPath = `source-zips/${timestamp}.zip`;

      const { error: picError } = await supabase.storage
        .from('uploads')
        .upload(profilePicPath, picToUpload, { upsert: true, cacheControl: '3600' });
      if (picError) {
        console.error('Profile picture upload error:', picError);
        setError('Failed to upload profile picture.');
        return;
      }

      const { error: zipError } = await supabase.storage
        .from('uploads')
        .upload(zipPath, sourceCodeZip, { upsert: true, cacheControl: '3600' });
      if (zipError) {
        console.error('Zip file upload error:', zipError);
        setError('Failed to upload source code.');
        return;
      }

      const { data: userData, error: authError } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (authError || !userId) {
        setError('User not authenticated.');
        return;
      }

      const { error: insertError } = await supabase.from('submissions').insert([
        {
          user_id: userId,
          full_name: fullName,
          phone,
          location,
          email,
          hobby,
          profile_picture: profilePicPath, // store the object key ONLY
          zip_file: zipPath,               // store the object key ONLY
        },
      ]);

      if (insertError) {
        console.error(insertError);
        setError('Failed to save your submission.');
        return;
      }

      setSuccess('Submission successful!');
      setFullName('');
      setPhone('');
      setLocation('');
      setEmail('');
      setHobby('');
      setProfilePic(null);
      setSourceCodeZip(null);
      if (picRef.current) picRef.current.value = '';
      if (zipRef.current) zipRef.current.value = '';
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 border rounded shadow bg-white">
      <h2 className="text-2xl font-bold mb-4">Developer Submission</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          className="w-full border px-4 py-2 rounded"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Phone Number"
          className="w-full border px-4 py-2 rounded"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Location"
          className="w-full border px-4 py-2 rounded"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email Address"
          className="w-full border px-4 py-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <textarea
          placeholder="What do you like to do in life (other than coding)?"
          className="w-full border px-4 py-2 rounded"
          value={hobby}
          onChange={(e) => setHobby(e.target.value)}
          required
        />

        <div>
          <label className="block mb-1 font-medium">
            Upload Profile Picture (max 1MB or will be compressed):
          </label>
          <input
            type="file"
            accept="image/*"
            ref={picRef}
            onChange={(e) => setProfilePic(e.target.files?.[0] ?? null)}
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Upload Source Code (zip):</label>
          <input
            type="file"
            accept=".zip,application/zip"
            ref={zipRef}
            onChange={(e) => setSourceCodeZip(e.target.files?.[0] ?? null)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`w-full text-white py-2 rounded ${submitting ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>

        {error && <p className="text-red-500 font-medium">{error}</p>}
        {success && (
          <div className="text-green-600 font-medium">
            <p>{success}</p>
            <p className="mt-2">
              <Link href="/dashboard/view" className="text-blue-600 underline">
                View My Submission
              </Link>
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
