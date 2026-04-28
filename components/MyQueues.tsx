// components/MyQueues.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import VoteAndPay from './VoteAndPay';

export default function MyQueues() {
  const [myQueues, setMyQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyQueues = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name)
      `)
      .eq('status', 'open');

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // Filter queues where the current user is in the players array
    const filtered = (data || []).filter((q: any) => {
      const players = q.players || [];
      return players.includes(user.id);
    });

    setMyQueues(filtered);
    setLoading(false);
  };

  useEffect(() => {
    loadMyQueues();
  }, []);

  if (loading) return <div className="px-8 mt-12 text-zinc-400">Loading your queues...</div>;

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">My Active Queues</h2>
      
      {myQueues.length === 0 ? (
        <p className="text-zinc-400">You are not in any active queues yet.</p>
      ) : (
        myQueues.map((q) => (
          <div key={q.id} className="bg-zinc-900 p-6 rounded-3xl mb-6">
            <h3 className="text-xl font-semibold mb-2">{q.stores.name}</h3>
            <p className="text-4xl font-bold mb-4">{q.current_count} / 8 players</p>

            {q.current_count >= 8 && (
              <VoteAndPay 
                queueId={q.id} 
                onVoted={loadMyQueues} 
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}