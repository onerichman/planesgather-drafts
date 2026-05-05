// components/MyQueues.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Queue = {
  id: number;
  current_count: number;
  status: string;
  firing_code: string | null;
  label: string | null;
  stores: { name: string };
};

export default function MyQueues() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);

  const loadQueues = async () => {
    const { data, error } = await supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name)
      `)
      .in('status', ['open', 'firing']);

    if (error) {
      console.error(error);
    } else {
      setQueues((data || []) as unknown as Queue[]);
    }
    setLoading(false);
  };

  // Realtime subscription
  useEffect(() => {
    loadQueues();

    const channel = supabase
      .channel('active-queues')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'draft_queues' 
        }, 
        () => {
          loadQueues();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Companion code ${code} copied to clipboard!`);
  };

  if (loading) {
    return <div className="px-8 mt-12 text-zinc-400">Loading active queues...</div>;
  }

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">Active Queues</h2>
      
      {queues.length === 0 ? (
        <p className="text-zinc-400">No active queues right now.</p>
      ) : (
        queues.map((q) => (
          <div key={q.id} className="bg-zinc-900 p-6 rounded-3xl mb-6">
            <h3 className="text-xl font-semibold mb-1">{q.stores.name}</h3>
            
            <div className="text-5xl font-bold text-green-400 mb-3">
              {q.current_count} / 8
            </div>

            <p className="capitalize mb-3">
              Status: <span className="font-bold">{q.status}</span>
            </p>

            {q.label && (
              <p className="text-yellow-400 font-medium mb-4">{q.label}</p>
            )}

            {q.status === 'firing' && q.firing_code && (
              <>
                <div 
                  onClick={() => copyCode(q.firing_code ?? '')}
                  className="p-4 bg-black rounded-xl text-2xl font-mono text-center mb-4 border border-yellow-400 cursor-pointer hover:bg-zinc-800 transition"
                >
                  Companion Code: {q.firing_code}
                  <span className="text-sm text-yellow-400 block mt-1">(Tap to copy)</span>
                </div>
                <button
                  onClick={() => {
                    window.location.href = `/join?code=${encodeURIComponent(q.firing_code || '')}`;
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-xl font-bold mb-4"
                >
                  Press here to join the queue in your companion app
                </button>
              </>
            )}

            {(q.status === 'firing' || q.status === 'open') && (
              <button
                onClick={() => {
                  if (confirm("Mark this queue as Completed?")) {
                    supabase
                      .from('draft_queues')
                      .update({ status: 'completed' })
                      .eq('id', q.id);
                  }
                }}
                className="mt-4 w-full bg-green-700 hover:bg-green-600 py-4 rounded-xl text-sm font-bold"
              >
                Mark as Completed
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
