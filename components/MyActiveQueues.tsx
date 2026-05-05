// components/MyActiveQueues.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type ActiveQueue = {
  id: number;
  current_count: number;
  status: string;
  firing_code: string | null;
  label: string | null;
  stores: { name: string };
};

const readNumberList = (key: string) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
};

const writeNumberList = (key: string, ids: number[]) => {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
};

const getStatusClass = (status: string) => {
  if (status === 'firing') return 'text-orange-400';
  if (status === 'canceled') return 'text-red-400';
  if (status === 'completed') return 'text-sky-400';
  return 'text-green-400';
};

export default function MyActiveQueues() {
  const [queues, setQueues] = useState<ActiveQueue[]>([]);
  const [copiedQueueId, setCopiedQueueId] = useState<number | null>(null);

  const loadMyQueues = useCallback(async () => {
    const joinedIds = readNumberList('joinedQueueIds');
    const withdrawnIds = readNumberList('withdrawnQueueIds');
    console.log("🔍 Reading joined IDs:", joinedIds);

    const query = supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name)
      `)
      .in('status', ['open', 'firing', 'canceled', 'completed']);

    const { data } = joinedIds.length > 0
      ? await query.or(`id.in.(${joinedIds.join(',')}),label.ilike.%Player Requested%`)
      : await query.ilike('label', '%Player Requested%');

    const uniqueQueues = new Map<number, ActiveQueue>();
    for (const queue of (data || []) as unknown as ActiveQueue[]) {
      // Exclude commander pods - only show draft queues
      if (queue.label && queue.label.toLowerCase().includes('commander')) continue;
      if (!withdrawnIds.includes(queue.id)) {
        uniqueQueues.set(queue.id, queue);
      }
    }

    setQueues(Array.from(uniqueQueues.values()));
  }, []);

  const withdrawFromQueue = async (queue: ActiveQueue) => {
    if (!confirm("Withdraw from this queue?")) return;

    writeNumberList('joinedQueueIds', readNumberList('joinedQueueIds').filter((id) => id !== queue.id));
    writeNumberList('withdrawnQueueIds', [...readNumberList('withdrawnQueueIds'), queue.id]);
    setQueues((current) => current.filter((q) => q.id !== queue.id));
    window.dispatchEvent(new CustomEvent('joinedQueuesChanged'));

    await supabase
      .from('draft_queues')
      .update({ current_count: Math.max((queue.current_count || 1) - 1, 0) })
      .eq('id', queue.id);

    window.refreshOtherQueues?.();
  };

  const copyCompanionCode = async (queue: ActiveQueue) => {
    if (!queue.firing_code) return;

    await navigator.clipboard.writeText(queue.firing_code);
    setCopiedQueueId(queue.id);
    setTimeout(() => setCopiedQueueId(null), 1800);
  };

  useEffect(() => {
    loadMyQueues();

    if (typeof window !== 'undefined') {
      window.refreshMyQueues = loadMyQueues;
    }

    // Re-check every 2 seconds (helps with timing issues)
    const interval = setInterval(loadMyQueues, 2000);
    return () => clearInterval(interval);
  }, [loadMyQueues]);

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">Your Active Queues</h2>
      
      {queues.length === 0 ? (
        <p className="text-zinc-400">You haven&apos;t joined any queues yet.</p>
      ) : (
        queues.map((q) => (
          <div key={q.id} className="bg-zinc-900 p-6 rounded-3xl mb-6 border border-green-500/50">
            <h3 className="text-xl font-semibold">{q.stores.name}</h3>
            <div className="text-5xl font-bold text-green-400 my-2">{q.current_count}/8</div>
            <p>Status: <span className={`capitalize font-bold ${getStatusClass(q.status)}`}>{q.status}</span></p>
            {q.label && <p className="text-yellow-400">{q.label}</p>}
            {q.status === 'firing' && q.firing_code && (
              <div className="mt-4 p-4 bg-black rounded-xl border border-orange-400">
                <p className="text-sm text-orange-300 mb-1">Companion App Code</p>
                <button
                  onClick={() => copyCompanionCode(q)}
                  className="w-full text-3xl font-mono font-bold py-2 rounded-lg hover:bg-zinc-900 active:scale-[0.98] transition"
                >
                  {q.firing_code}
                </button>
                <p className="text-xs text-zinc-400 mt-1 mb-4">
                  {copiedQueueId === q.id ? 'Copied' : 'Tap code to copy'}
                </p>

                <button
                  onClick={() => {
                    const joinLink = `${window.location.origin}/join?code=${encodeURIComponent(q.firing_code || '')}`;
                    window.location.href = joinLink;
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl text-base font-bold transition"
                >
                  Press here to join the queue in your companion app
                </button>
              </div>
            )}
            {q.status === 'canceled' && (
              <div className="mt-4 p-4 bg-red-950 border border-red-500 rounded-xl text-red-100 text-center font-medium">
                This queue was canceled by the store.
              </div>
            )}
            {q.status === 'completed' && (
              <div className="mt-4 p-4 bg-sky-950 border border-sky-500 rounded-xl text-sky-100 text-center font-medium">
                Check your app for standings and staff for prizing.
              </div>
            )}
            {(q.status === 'open' || q.status === 'firing') && (
              <button
                onClick={() => withdrawFromQueue(q)}
                className="mt-5 w-full bg-zinc-800 hover:bg-red-700 border border-zinc-700 hover:border-red-500 py-3 rounded-xl text-sm font-bold transition"
              >
                Withdraw
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
