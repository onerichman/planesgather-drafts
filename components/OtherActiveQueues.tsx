// components/OtherActiveQueues.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  onJoin: (queueId: number) => void;
}

export default function OtherActiveQueues({ onJoin }: Props) {
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadQueues = async () => {
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

    setQueues(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadQueues();

    const channel = supabase
      .channel('other-queues')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'draft_queues' },
        loadQueues
      )
      .subscribe();

    if (typeof window !== 'undefined') {
      (window as any).refreshOtherQueues = loadQueues;
    }

    return () => supabase.removeChannel(channel);
  }, []);

  // Read joined queues
  let joinedQueueIds: number[] = [];
  if (typeof window !== 'undefined') {
    try {
      joinedQueueIds = JSON.parse(localStorage.getItem('joinedQueueIds') || '[]');
    } catch (e) {
      joinedQueueIds = [];
    }
  }

  // Strong filter: hide if already joined OR has players
  const filteredQueues = queues.filter(q => {
    const isJoined = joinedQueueIds.includes(q.id);
    const hasPlayers = q.current_count > 0;
    return !isJoined && !hasPlayers;
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