'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

const maxPlayers = (label?: string | null) =>
  label?.toLowerCase().includes('commander') ? 4 : 8;

type JoinQueue = {
  id: number;
  current_count: number;
  status: string;
  firing_code: string | null;
  label: string | null;
  queue_number: number;
  stores: { name: string };
};

export default function JoinClient({ code }: { code: string }) {
  const [queue, setQueue] = useState<JoinQueue | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'joined' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchQueue = async () => {
      if (!code) {
        setStatus('error');
        setMessage('Missing join code');
        return;
      }

      const { data, error } = await supabase
        .from('draft_queues')
        .select(`*, stores!inner(name)`)
        .eq('firing_code', code)
        .eq('status', 'firing')
        .single();

      if (error || !data) {
        setStatus('error');
        setMessage('Invalid or expired join link');
        return;
      }

      setQueue(data as JoinQueue);
      setStatus('ready');
    };

    fetchQueue();
  }, [code]);

  const handleJoin = async () => {
    if (!queue) return;

    if (queue.current_count >= maxPlayers(queue.label)) {
      setStatus('error');
      setMessage('This queue is already full');
      return;
    }

    setStatus('joining');

    const { error } = await supabase
      .from('draft_queues')
      .update({ current_count: queue.current_count + 1 })
      .eq('id', queue.id);

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    const joinedIds = readNumberList('joinedQueueIds');
    writeNumberList('joinedQueueIds', [...joinedIds, queue.id]);
    window.dispatchEvent(new CustomEvent('joinedQueuesChanged'));

    setStatus('joined');
    setMessage(`Joined queue at ${queue.stores.name}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Join Companion Queue</h1>
        {status === 'loading' && (
          <div className="p-6 bg-zinc-900 rounded-3xl text-center">Loading queue...</div>
        )}

        {(status === 'error' || !queue) && message && (
          <div className="p-6 bg-red-900 rounded-3xl mb-6 text-red-200">{message}</div>
        )}

        {queue && status !== 'loading' && (
          <div className="bg-zinc-900 rounded-3xl p-6 space-y-5">
            <div>
              <div className="text-sm text-zinc-400 mb-1">Store</div>
              <div className="text-2xl font-bold">{queue.stores.name}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400 mb-1">Queue</div>
              <div className="text-xl">#{queue.queue_number}</div>
            </div>
            {queue.label && <div className="text-yellow-300">{queue.label}</div>}
            <div className="text-4xl font-bold text-emerald-400">{queue.current_count}/{maxPlayers(queue.label)}</div>
            <button
              onClick={handleJoin}
              disabled={status === 'joining' || status === 'joined'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 py-5 rounded-3xl font-bold text-lg disabled:opacity-50"
            >
              {status === 'joining' ? 'Joining…' : status === 'joined' ? 'Joined!' : 'Press here to join the queue in your companion app'}
            </button>
            {status === 'joined' && (
              <p className="text-green-300 text-center">{message}</p>
            )}
            {status === 'ready' && (
              <p className="text-zinc-400 text-center">Use this button to join immediately after scanning the QR link.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
