// components/MyActiveQueues.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MyActiveQueues() {
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyQueues = async () => {
    const joinedIds = JSON.parse(localStorage.getItem('joinedQueueIds') || '[]');
    
    console.log("Loading queues for IDs:", joinedIds); // For debugging

    if (joinedIds.length === 0) {
      setQueues([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name)
      `)
      .in('id', joinedIds)
      .in('status', ['open', 'firing']);

    if (error) console.error("Error:", error);
    
    setQueues(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMyQueues();

    if (typeof window !== 'undefined') {
      (window as any).refreshMyQueues = loadMyQueues;
    }
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Code copied: ${code}`);
  };

  const withdrawFromQueue = async (queueId: number) => {
    if (!confirm("Withdraw from this queue?")) return;

    const joinedIds = JSON.parse(localStorage.getItem('joinedQueueIds') || '[]');
    const updatedIds = joinedIds.filter((id: number) => id !== queueId);
    localStorage.setItem('joinedQueueIds', JSON.stringify(updatedIds));

    // Decrease count
    await supabase
      .from('draft_queues')
      .update({ current_count: supabase.rpc('decrement_count', { row_id: queueId }) }) // optional
      .eq('id', queueId);

    loadMyQueues();
    if (typeof window !== 'undefined' && (window as any).refreshOtherQueues) {
      (window as any).refreshOtherQueues();
    }
  };

  if (loading) return <div className="px-8 mt-12 text-zinc-400">Loading your queues...</div>;

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">Your Active Queues</h2>
      
      {queues.length === 0 ? (
        <p className="text-zinc-400 mb-8">You haven't joined any queues yet.</p>
      ) : (
        queues.map((q) => (
          <div key={q.id} className="bg-zinc-900 p-6 rounded-3xl mb-6 border border-green-500/50">
            <h3 className="text-xl font-semibold">{q.stores.name}</h3>
            <div className="text-5xl font-bold text-green-400 my-2">{q.current_count}/8</div>
            
            <p>Status: <span className="capitalize font-medium">{q.status}</span></p>
            {q.label && <p className="text-yellow-400">{q.label}</p>}

            {q.firing_code && (
              <div 
                onClick={() => copyCode(q.firing_code)}
                className="mt-4 p-4 bg-black rounded-xl text-xl font-mono cursor-pointer hover:bg-zinc-800"
              >
                Code: {q.firing_code} (tap to copy)
              </div>
            )}

            <button
              onClick={() => withdrawFromQueue(q.id)}
              className="mt-6 w-full bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium text-white"
            >
              Withdraw from Queue
            </button>
          </div>
        ))
      )}
    </div>
  );
}