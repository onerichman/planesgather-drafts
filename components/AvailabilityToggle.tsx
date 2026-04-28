'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AvailabilityToggle() {
  const [status, setStatus] = useState<'off' | 'looking_now'>('off');

  const toggle = async () => {
    const newStatus = status === 'off' ? 'looking_now' : 'off';
    await supabase.from('profiles').update({ 
      availability_status: newStatus,
      availability_updated_at: new Date().toISOString()
    });
    setStatus(newStatus);
  };

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-zinc-900 border border-green-500 rounded-full px-6 py-3 shadow-2xl z-50 flex items-center gap-4">
      <span className="font-medium">I'm open for games</span>
      <button
        onClick={toggle}
        className={`px-6 py-2 rounded-full font-bold transition ${status === 'off' ? 'bg-zinc-700' : 'bg-green-600'}`}
      >
        {status === 'off' ? 'OFF' : 'ON'}
      </button>
    </div>
  );
}