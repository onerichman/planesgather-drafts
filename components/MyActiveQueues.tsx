// components/MyActiveQueues.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId, readNumberList, writeNumberList } from '@/utils/storage';

type ActiveQueue = {
  id: number;
  current_count: number;
  status: string;
  firing_code: string | null;
  label: string | null;
  stores: { name: string };
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
  const [userId, setUserId] = useState<string | null>(null);

  console.log("🚀 MyActiveQueues component mounted/updated", { userId });

  const loadMyQueues = useCallback(async () => {
    const joinedIds = readNumberList('joinedQueueIds', userId);
    const withdrawnIds = readNumberList('withdrawnQueueIds', userId);
    console.log("🔍 Reading joined IDs from localStorage:", joinedIds);
    console.log("🚫 Reading withdrawn IDs from localStorage:", withdrawnIds);

    // First, get all queues that could potentially be joined
    const allQueuesResult = await supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name)
      `);

    console.log("📊 All queues query result:", allQueuesResult);

    const allQueues = (allQueuesResult.data || []) as ActiveQueue[];
    console.log("📊 All queues found:", allQueues.length, allQueues.map(q => ({ id: q.id, status: q.status, label: q.label })));

    // Filter to only joined queues
    const data = allQueues.filter(queue => joinedIds.includes(queue.id));
    console.log("🔄 After filtering by joined IDs:", data.length, data.map(q => ({ id: q.id, status: q.status })));

    console.log("🔄 Processing queues:", data.length);
    const uniqueQueues = new Map<number, ActiveQueue>();
    for (const queue of data) {
      console.log(`🔍 Checking queue ${queue.id}: status=${queue.status}, label=${queue.label}`);
      // Exclude commander pods - only show draft queues
      if (queue.label && queue.label.toLowerCase().includes('commander')) {
        console.log(`🚫 Skipping commander queue ${queue.id}`);
        continue;
      }
      if (!withdrawnIds.includes(queue.id)) {
        console.log(`✅ Adding queue ${queue.id} to display`);
        uniqueQueues.set(queue.id, queue);
      } else {
        console.log(`🚫 Skipping withdrawn queue ${queue.id}`);
      }
    }

    const finalQueues = Array.from(uniqueQueues.values());
    console.log("🎯 Final queues to display:", finalQueues.length, finalQueues.map(q => ({ id: q.id, status: q.status })));
    setQueues(finalQueues);
  }, [userId]);

  const withdrawFromQueue = async (queue: ActiveQueue) => {
    if (!confirm("Withdraw from this queue?")) return;

    writeNumberList('joinedQueueIds', readNumberList('joinedQueueIds', userId).filter((id) => id !== queue.id), userId);
    writeNumberList('withdrawnQueueIds', [...readNumberList('withdrawnQueueIds', userId), queue.id], userId);
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
    const loadUser = async () => {
      const id = await getCurrentUserId();
      setUserId(id);
    };

    loadUser();
    loadMyQueues();

    if (typeof window !== 'undefined') {
      window.refreshMyQueues = loadMyQueues;
    }

    // Listen for changes to joined queues
    const handleJoinedQueuesChanged = () => {
      console.log("🎯 joinedQueuesChanged event received");
      loadMyQueues();
    };
    window.addEventListener('joinedQueuesChanged', handleJoinedQueuesChanged);

    const handleAuthOrProfileUpdate = () => {
      console.log("🔄 auth/profile update detected, reloading active queues");
      loadMyQueues();
    };
    window.addEventListener('focus', handleAuthOrProfileUpdate);
    window.addEventListener('profileUpdated', handleAuthOrProfileUpdate);
    window.addEventListener('authChanged', handleAuthOrProfileUpdate);

    // Listen for storage changes (in case localStorage is modified externally)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'joinedQueueIds' || e.key === 'withdrawnQueueIds') {
        console.log("💾 localStorage changed:", e.key, e.oldValue, "->", e.newValue);
        loadMyQueues();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Re-check every 2 seconds (helps with timing issues)
    const interval = setInterval(loadMyQueues, 2000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('joinedQueuesChanged', handleJoinedQueuesChanged);
      window.removeEventListener('focus', handleAuthOrProfileUpdate);
      window.removeEventListener('profileUpdated', handleAuthOrProfileUpdate);
      window.removeEventListener('authChanged', handleAuthOrProfileUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
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
