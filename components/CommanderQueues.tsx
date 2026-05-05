'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDistance } from '@/utils/distance';

type Store = {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
};

type CommanderQueue = {
  id: number;
  current_count: number;
  status: string;
  label: string | null;
  queue_number: number;
  stores: { name: string; lat: number; lng: number };
};

const joinedKey = 'joinedCommanderQueueIds';
const withdrawnKey = 'withdrawnCommanderQueueIds';
const maxPlayers = 4;

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

export default function CommanderQueues() {
  const [stores, setStores] = useState<Store[]>([]);
  const [queues, setQueues] = useState<CommanderQueue[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyPods, setNearbyPods] = useState<CommanderQueue[]>([]);
  const [showNearbyModal, setShowNearbyModal] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadStores = useCallback(async () => {
    const { data } = await supabase.from('stores').select('id, name, lat, lng');
    const allStores = (data || []) as Store[];

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const sorted = [...allStores].sort((a, b) => {
          if (!a.lat || !a.lng) return 1;
          if (!b.lat || !b.lng) return -1;
          return (
            getDistance(pos.coords.latitude, pos.coords.longitude, a.lat, a.lng) -
            getDistance(pos.coords.latitude, pos.coords.longitude, b.lat, b.lng)
          );
        });
        setStores(sorted);
        setSelectedStoreId(sorted[0]?.id ?? null);
      },
      () => {
        setStores(allStores);
        setSelectedStoreId(allStores[0]?.id ?? null);
      }
    );
  }, []);

  const loadQueues = useCallback(async () => {
    const withdrawnIds = readNumberList(withdrawnKey);
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
      .ilike('label', 'Commander%')
      .order('created_at', { ascending: false });

    const commanderQueues = ((data || []) as unknown as CommanderQueue[])
      .filter((queue) => !withdrawnIds.includes(queue.id));

    setQueues(commanderQueues);
    setJoinedIds(readNumberList(joinedKey));
  }, []);

  useEffect(() => {
    loadStores();
    loadQueues();
    const interval = setInterval(loadQueues, 2500);
    return () => clearInterval(interval);
  }, [loadQueues, loadStores]);

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log("Location access denied")
    );
  }, []);

  const createQueue = async () => {
    if (!selectedStoreId) {
      alert('Please select a store');
      return;
    }

    setLoading(true);
    const { data: existing } = await supabase
      .from('draft_queues')
      .select('queue_number')
      .eq('store_id', selectedStoreId)
      .order('queue_number', { ascending: false })
      .limit(1);

    const nextNumber = (existing?.[0]?.queue_number || 0) + 1;
    const finalLabel = label.trim() ? `Commander - ${label.trim()}` : 'Commander';

    const { data: newQueue, error } = await supabase
      .from('draft_queues')
      .insert({
        store_id: selectedStoreId,
        current_count: 1,
        status: 'open',
        players: [],
        queue_number: nextNumber,
        label: finalLabel,
      })
      .select('id')
      .single();

    setLoading(false);

    if (error) {
      alert('Could not create Commander queue: ' + error.message);
      return;
    }

    if (newQueue?.id) {
      writeNumberList(joinedKey, [...readNumberList(joinedKey), newQueue.id]);
      writeNumberList(withdrawnKey, readNumberList(withdrawnKey).filter((id) => id !== newQueue.id));
      setJoinedIds(readNumberList(joinedKey));
    }

    setLabel('');
    setMessage('Commander queue created.');
    setTimeout(() => setMessage(''), 4000);
    loadQueues();
  };

  const joinQueue = async (queue: CommanderQueue) => {
    if (joinedIds.includes(queue.id)) {
      alert('You are already in this queue');
      return;
    }
    if (queue.current_count >= maxPlayers) {
      alert('This Commander pod is full');
      return;
    }

    await supabase
      .from('draft_queues')
      .update({ current_count: queue.current_count + 1 })
      .eq('id', queue.id);

    writeNumberList(joinedKey, [...readNumberList(joinedKey), queue.id]);
    writeNumberList(withdrawnKey, readNumberList(withdrawnKey).filter((id) => id !== queue.id));
    setJoinedIds(readNumberList(joinedKey));
    loadQueues();
  };

  const withdrawQueue = async (queue: CommanderQueue) => {
    if (!confirm('Withdraw from this Commander queue?')) return;

    writeNumberList(joinedKey, readNumberList(joinedKey).filter((id) => id !== queue.id));
    writeNumberList(withdrawnKey, [...readNumberList(withdrawnKey), queue.id]);
    setJoinedIds(readNumberList(joinedKey));
    setQueues((current) => current.filter((q) => q.id !== queue.id));

    await supabase
      .from('draft_queues')
      .update({ current_count: Math.max((queue.current_count || 1) - 1, 0) })
      .eq('id', queue.id);
  };

  const findNearbyPods = async () => {
    if (!location) {
      alert("Please enable location access to find nearby pods");
      return;
    }

    setSearchLoading(true);

    const { data } = await supabase
      .from('draft_queues')
      .select(`
        id,
        current_count,
        status,
        label,
        queue_number,
        stores!inner(name, lat, lng)
      `)
      .in('status', ['open', 'firing'])
      .ilike('label', 'Commander%');

    const commanderQueues = ((data || []) as unknown as CommanderQueue[])
      .filter((q) => !joinedIds.includes(q.id) && q.current_count < maxPlayers && q.stores?.lat && q.stores?.lng);

    const nearby = commanderQueues.filter((q) => {
      const distance = getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng);
      return distance <= 100;
    });

    setNearbyPods(nearby);
    setShowNearbyModal(true);
    setSearchLoading(false);
  };

  const joinNearbyPod = async (queue: CommanderQueue) => {
    if (queue.current_count >= maxPlayers) {
      alert('This Commander pod is full');
      return;
    }

    await supabase
      .from('draft_queues')
      .update({ current_count: queue.current_count + 1 })
      .eq('id', queue.id);

    writeNumberList(joinedKey, [...readNumberList(joinedKey), queue.id]);
    writeNumberList(withdrawnKey, readNumberList(withdrawnKey).filter((id) => id !== queue.id));
    setJoinedIds(readNumberList(joinedKey));
    setShowNearbyModal(false);
    loadQueues();
  };

  const myQueues = queues.filter((queue) => joinedIds.includes(queue.id));
  const openQueues = queues.filter((queue) => !joinedIds.includes(queue.id) && queue.current_count < maxPlayers);

  return (
    <div className="px-8 mt-8 space-y-10">
      <section>
        <button
          onClick={findNearbyPods}
          disabled={searchLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-6 rounded-2xl text-2xl font-bold"
        >
          {searchLoading ? 'Searching...' : '🔍 Find a Pod Near Me'}
        </button>
      </section>

      {showNearbyModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">Pods Nearby</h2>
              <button onClick={() => setShowNearbyModal(false)} className="text-2xl text-zinc-400 hover:text-white">✕</button>
            </div>
            
            {nearbyPods.length === 0 ? (
              <p className="text-zinc-400">No Commander pods within 100 miles.</p>
            ) : (
              nearbyPods.map((q) => {
                const distance = location ? Math.round(getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng)) : 0;
                return (
                  <div key={q.id} className="bg-zinc-800 p-6 rounded-2xl mb-6">
                    <h3 className="text-xl font-semibold">{q.stores.name}</h3>
                    <p className="text-sm opacity-70">
                      Queue #{q.queue_number} • {distance} miles
                    </p>
                    <div className="text-5xl font-bold my-4 text-emerald-400">
                      {q.current_count} / {maxPlayers}
                    </div>
                    {q.label && <p className="text-yellow-300 mb-4">{q.label}</p>}

                    <button
                      onClick={() => joinNearbyPod(q)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 py-5 rounded-xl font-bold text-lg"
                    >
                      Join Pod
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <section className="bg-zinc-950/80 border border-zinc-800 p-6 rounded-3xl">
        <h2 className="text-2xl font-bold mb-5">Create Commander Pod</h2>
        <label className="block text-sm text-zinc-400 mb-2">Store</label>
        <select
          value={selectedStoreId ?? ''}
          onChange={(e) => setSelectedStoreId(Number(e.target.value))}
          className="w-full p-4 bg-zinc-900 border border-zinc-700 rounded-2xl mb-4"
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>

        <label className="block text-sm text-zinc-400 mb-2">Optional note</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Casual, precon, high power..."
          className="w-full p-4 bg-zinc-900 border border-zinc-700 rounded-2xl mb-5"
        />

        <button
          onClick={createQueue}
          disabled={loading || !selectedStoreId}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-5 rounded-2xl text-lg font-bold"
        >
          {loading ? 'Creating...' : 'Create Commander Queue'}
        </button>
        {message && <p className="mt-4 text-center text-emerald-300">{message}</p>}
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Your Commander Queues</h2>
        {myQueues.length === 0 ? (
          <p className="text-zinc-300">You have not joined a Commander queue yet.</p>
        ) : (
          myQueues.map((queue) => (
            <div key={queue.id} className="bg-zinc-950/85 border border-emerald-500/50 p-6 rounded-3xl mb-5">
              <h3 className="text-xl font-semibold">{queue.stores.name}</h3>
              <div className="text-5xl font-bold text-emerald-400 my-2">{queue.current_count}/{maxPlayers}</div>
              {queue.label && <p className="text-yellow-300">{queue.label}</p>}
              <button
                onClick={() => withdrawQueue(queue)}
                className="mt-5 w-full bg-zinc-800 hover:bg-red-700 border border-zinc-700 hover:border-red-500 py-3 rounded-xl text-sm font-bold transition"
              >
                Withdraw
              </button>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Open Commander Queues</h2>
        {openQueues.length === 0 ? (
          <p className="text-zinc-300">No open Commander queues right now.</p>
        ) : (
          openQueues.map((queue) => (
            <div key={queue.id} className="bg-zinc-950/85 p-6 rounded-3xl mb-5 border border-zinc-800">
              <h3 className="text-xl font-semibold">{queue.stores.name}</h3>
              <div className="text-4xl font-bold text-emerald-400 my-2">{queue.current_count}/{maxPlayers}</div>
              {queue.label && <p className="text-yellow-300">{queue.label}</p>}
              <p className="text-sm text-zinc-400">Queue #{queue.queue_number}</p>
              <button
                onClick={() => joinQueue(queue)}
                className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-xl font-bold"
              >
                Join Commander Queue
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
