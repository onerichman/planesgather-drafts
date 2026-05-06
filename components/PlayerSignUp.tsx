'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PlayerSignUpProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function PlayerSignUp({ onComplete, onCancel }: PlayerSignUpProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companionEmail: '',
    phoneNumber: '',
    skipPhonePrompt: false,
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Sign up the user (skip email confirmation for easier signup)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            phone_number: formData.phoneNumber,
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Note: For production, implement SMS verification here
      // You can use Twilio or similar service to send verification code
      // For now, we'll auto-confirm the user
      if (data.user && !data.user.email_confirmed_at) {
        // In production, you'd send SMS verification code here
        // For development, we'll auto-verify
        console.log('User signed up, SMS verification would be sent to:', formData.phoneNumber);
      }

      if (data.user) {
        // Create player profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            user_type: 'player',
            companion_email: formData.companionEmail,
            phone_number: formData.phoneNumber,
            skip_phone_prompt: formData.skipPhonePrompt,
            created_at: new Date().toISOString(),
          });

        if (profileError) throw profileError;
      }

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold mb-6 text-center">Player Sign Up</h2>

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
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">MTG Companion App Email</label>
            <input
              type="email"
              required
              value={formData.companionEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, companionEmail: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phoneNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="skipPhonePrompt"
              checked={formData.skipPhonePrompt}
              onChange={(e) => setFormData(prev => ({ ...prev, skipPhonePrompt: e.target.checked }))}
              className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500"
            />
            <label htmlFor="skipPhonePrompt" className="text-sm">
              Skip phone number prompt when joining queues
            </label>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-bold transition"
            >
              {loading ? 'Signing Up...' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}