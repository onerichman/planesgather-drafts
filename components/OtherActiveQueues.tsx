// components/OtherActiveQueues.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId, readNumberList } from '@/utils/storage';

interface Props {
  onJoin: (queueId: number) => void;
}

type ActiveQueue = {
  id: number;
  current_count: number;
  status: string;
  label: string | null;
  queue_number: number;
  stores: { name: string };
};

export default function OtherActiveQueues({ onJoin }: Props): import("react/jsx-runtime").JSX.Element {
  const [queues, setQueues] = useState<ActiveQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadQueues = useCallback(async (): Promise<void> => {
    const { data } = await supabase
      .from('draft_queues')
      .select(`
        id, 
        current_count, 
        status, 
        label, 
        queue_number,
        stores!inner(name)
      `)
      .in('status', ['open', 'firing'])
      .order('created_at', { ascending: false });

    setQueues((data || []) as unknown as ActiveQueue[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadUser = async () => setUserId(await getCurrentUserId());
    loadUser();
    loadQueues();

    const channel = supabase
      .channel('other-queues')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'draft_queues' },
        loadQueues
      )
      .subscribe();

    if (typeof window !== 'undefined') {
      window.refreshOtherQueues = loadQueues;
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadQueues]);

  // Read joined queues for current user
  let joinedQueueIds: number[] = [];
  if (typeof window !== 'undefined') {
    joinedQueueIds = readNumberList('joinedQueueIds', userId);
  }

  if (loading) {
    return <div className="px-8 mt-12 text-zinc-400">Loading active queues...</div>;
  }

  // Strong filter: hide if already joined OR has players OR is a commander queue
  const filteredQueues = queues.filter(q => {
    const isJoined = joinedQueueIds.includes(q.id);
    const hasPlayers = q.current_count > 0;
    // Exclude commander pods - only show draft queues
    const isCommander = q.label && q.label.toLowerCase().includes('commander');
    return !isJoined && !hasPlayers && !isCommander;
  });

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">Other Active Queues Nearby</h2>
      
      {filteredQueues.length === 0 ? (
        <p className="text-zinc-400">No other active queues right now.</p>
      ) : (
        filteredQueues.map((q) => (
          <div 
            key={q.id} 
            onClick={() => onJoin(q.id)}
            className="bg-zinc-900 p-6 rounded-3xl mb-6 hover:border hover:border-green-500 cursor-pointer transition-all active:scale-[0.98]"
          >
            <h3 className="text-xl font-semibold">{q.stores.name}</h3>
            <div className="text-4xl font-bold my-2 text-green-400">{q.current_count}/8</div>
            
            <p className="capitalize">Status: <span className="font-medium">{q.status}</span></p>
            {q.label && <p className="text-yellow-400 mt-1">{q.label}</p>}
            <p className="text-sm text-zinc-500">Queue #{q.queue_number}</p>

            <div className="mt-4 text-center text-green-400 font-bold text-sm border border-green-500/50 py-3 rounded-xl">
              Click here to Join Now
            </div>
          </div>
        ))
      )}
    </div>
  );
}
