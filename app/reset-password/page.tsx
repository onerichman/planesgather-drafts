'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordContent() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we have the required tokens in the URL
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // Set the session with the tokens from the URL
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8">
      <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Reset Your Password</h1>

        {success ? (
          <div className="text-center">
            <div className="bg-green-900/50 border border-green-500 text-green-200 p-4 rounded-lg mb-4">
              Password updated successfully! Redirecting...
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Enter your new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Confirm your new password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-bold transition mt-6"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}

        <button
          onClick={() => router.push('/')}
          className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold transition mt-4"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}