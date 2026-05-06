'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface StoreSignUpProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function StoreSignUp({ onComplete, onCancel }: StoreSignUpProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    address: '',
    website: '',
    capacity: '',
    lastStartTime: '22:00',
    availableSets: [] as string[],
  });
  const [error, setError] = useState('');

  const availableSetOptions = [
    'Aetherdrift',
    'Bloomburrow',
    'Foundations',
    'Modern Horizons 3',
    'Chaos Draft',
    'Custom Sets'
  ];

  const handleSetToggle = (setName: string) => {
    setFormData(prev => ({
      ...prev,
      availableSets: prev.availableSets.includes(setName)
        ? prev.availableSets.filter(s => s !== setName)
        : [...prev.availableSets, setName]
    }));
  };

  const geocodeAddress = async (address: string) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!response.ok) return null;
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const match = results[0];
    return {
      lat: Number(match.lat),
      lng: Number(match.lon),
    };
  };

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
      const location = await geocodeAddress(formData.address);
      if (!location) {
        setError('Could not determine location from the address provided. Please check the address and try again.');
        setLoading(false);
        return;
      }

      // Sign up the user (skip email confirmation for easier signup)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
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
      console.log('Store signed up, ready for SMS verification if needed');

      if (data.user) {
        // Create store profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            user_type: 'store',
            store_name: formData.storeName,
            address: formData.address,
            website: formData.website,
            capacity: parseInt(formData.capacity),
            last_start_time: formData.lastStartTime,
            available_sets: formData.availableSets,
            created_at: new Date().toISOString(),
          });

        if (profileError) throw profileError;

        // Create store record with geo location
        const { error: storeError } = await supabase
          .from('stores')
          .insert({
            name: formData.storeName,
            slug: formData.storeName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            address: formData.address,
            website: formData.website,
            lat: location.lat,
            lng: location.lng,
            max_capacity: parseInt(formData.capacity),
            last_start_time: formData.lastStartTime,
            available_sets: formData.availableSets,
            owner_id: data.user.id,
          });

        if (storeError) throw storeError;
      }

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full my-8">
        <h2 className="text-3xl font-bold mb-6 text-center">Store Sign Up</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium mb-1">Store Name</label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData(prev => ({ ...prev, storeName: e.target.value }))}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
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
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              type="text"
              required
              placeholder="123 Main St, City, State, ZIP"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-zinc-400 mt-1">Directions will be automatically generated from this address</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Website (Optional)</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Capacity</label>
              <input
                type="number"
                required
                min="1"
                max="50"
                value={formData.capacity}
                onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Last Available Start Time</label>
            <input
              type="time"
              required
              value={formData.lastStartTime}
              onChange={(e) => setFormData(prev => ({ ...prev, lastStartTime: e.target.value }))}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-zinc-400 mt-1">No new drafts will start after this time</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Available Sets for Drafting</label>
            <div className="grid grid-cols-2 gap-2">
              {availableSetOptions.map(setName => (
                <label key={setName} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.availableSets.includes(setName)}
                    onChange={() => handleSetToggle(setName)}
                    className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">{setName}</span>
                </label>
              ))}
            </div>
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
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-bold transition"
            >
              {loading ? 'Creating Store...' : 'Create Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}