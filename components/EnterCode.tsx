// components/EnterCode.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function EnterCode() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submitCode = async () => {
    if (code.length !== 6) {
      setStatus('error');
      setMessage("Please enter a 6-digit code");
      return;
    }

    const { data, error } = await supabase
      .from('draft_queues')
      .select('*')
      .eq('firing_code', code)
      .eq('status', 'firing')
      .single();

    if (error || !data) {
      setStatus('error');
      setMessage("Invalid or expired code");
      return;
    }

    setStatus('success');
    setMessage(`Successfully joined queue at ${data.stores?.name || 'the store'}!`);
    
    // Optional: mark as completed after some time or manual button
  };

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">Enter Companion Code</h2>
      <p className="text-zinc-400 mb-6">If your queue is firing, enter the 6-digit code here</p>

      <input
        type="text"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="w-full p-6 bg-zinc-800 rounded-2xl text-3xl text-center font-mono mb-6"
      />

      <button
        onClick={submitCode}
        className="w-full bg-green-600 py-6 rounded-2xl font-bold text-xl"
      >
        Submit Code
      </button>

      {status === 'success' && (
        <div className="mt-6 p-6 bg-green-900 rounded-2xl text-center">
          <p className="text-green-400 font-bold text-xl">{message}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-6 p-6 bg-red-900 rounded-2xl text-center">
          <p className="text-red-400">{message}</p>
        </div>
      )}
    </div>
  );
}