'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface LoginProps {
  onComplete: () => void;
  onCancel: () => void;
  onSwitchToSignUp: () => void;
  userType: 'player' | 'store';
}

export default function Login({ onComplete, onCancel, onSwitchToSignUp, userType }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setError('Password reset email sent! Check your inbox.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setError('');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold mb-6 text-center">
          {userType === 'store' ? 'Store Login' : 'Player Login'}
        </h2>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Forgot Password?
            </button>
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-bold transition"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold transition"
            >
              Need an account? Sign Up
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-bold transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-3xl font-bold mb-6 text-center">Reset Password</h2>

            {error && (
              <div className="bg-blue-900/50 border border-blue-500 text-blue-200 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Enter your email address"
                />
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-bold transition"
                >
                  {loading ? 'Sending...' : 'Send Reset Email'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                  }}
                  className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold transition"
                >
                  Back to Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}