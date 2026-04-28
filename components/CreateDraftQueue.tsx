// components/CreateDraftQueue.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  storeId: number;
  onCreated: () => void;
}

export default function CreateDraftQueue({ storeId, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data } = await supabase.auth.getUser();
    setIsSignedIn(!!data.user);
  };

  const createQueue = async () => {
    if (!isSignedIn) {
      alert("Please sign in first");
      window.location.href = '/auth';
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('draft_queues').insert({
      store_id: storeId,
      current_count: 1,
      status: 'open',
      players: [user!.id]
    });

    setLoading(false);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Draft queue created successfully!');
      onCreated();
    }
  };

  return (
    <button
      onClick={createQueue}
      disabled={loading}
      className="bg-yellow-600 hover:bg-yellow-700 w-full py-6 rounded-2xl text-xl font-bold mt-8 disabled:opacity-50"
    >
      {loading ? 'Creating...' : isSignedIn ? '+ Create New Draft Queue' : 'Sign In to Create Queue'}
    </button>
  );
}