// components/PhoneOptInModal.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  userId: string | null;
  onOptIn: () => void;
  onCancel: () => void;
}

export default function PhoneOptInModal({ userId, onOptIn, onCancel }: Props) {
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!userId) {
      alert('Please sign in before saving your phone number.');
      return;
    }

    if (!phone || !agreed) {
      alert("Please enter phone number and agree to terms");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: phone.trim(), skip_phone_prompt: true })
      .eq('id', userId);

    if (error) {
      setLoading(false);
      alert(`Error saving phone number: ${error.message}`);
      return;
    }

    setLoading(false);
    window.dispatchEvent(new Event('profileUpdated'));
    alert("Phone number saved! You can now join queues.");
    onOptIn();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl p-8 max-w-sm w-full">
        <h2 className="text-2xl font-bold mb-4">Enter Phone Number</h2>
        <p className="mb-6 text-zinc-400">We&apos;ll text you when your draft is ready to start.</p>

        <input
          type="tel"
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-4 bg-zinc-800 rounded-2xl mb-6 text-lg"
        />

        <label className="flex gap-3 items-center mb-8">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-sm">I agree to receive SMS notifications</span>
        </label>

        <button
          onClick={handleSave}
          disabled={loading || !phone || !agreed}
          className="w-full bg-green-600 py-5 rounded-2xl font-bold text-lg disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save & Join Queue"}
        </button>

        <button onClick={onCancel} className="mt-4 text-zinc-400 w-full">
          Cancel
        </button>
      </div>
    </div>
  );
}
