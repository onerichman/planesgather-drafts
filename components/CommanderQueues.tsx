'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDistance } from '@/utils/distance';
import { getCurrentUserId, readNumberList, writeNumberList } from '@/utils/storage';

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


export default function CommanderQueues() {
  const [stores, setStores] = useState<Store[]>([]);
  const [queues, setQueues] = useState<CommanderQueue[]>([]);
  const [participantStatuses, setParticipantStatuses] = useState<Record<number, { status: 'enroute' | 'at_store'; joined_at: string }>>({});
  const [allParticipants, setAllParticipants] = useState<Record<number, Array<{ status: 'enroute' | 'at_store'; joined_at: string; user_id: string }>>>({});
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
    const withdrawnIds = readNumberList(withdrawnKey, userId);
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
    setJoinedIds(readNumberList(joinedKey, userId));
  }, [userId]);

  useEffect(() => {
    const loadUser = async () => {
      const id = await getCurrentUserId();
      setUserId(id);
    };
    loadUser();
    loadStores();
    loadQueues();
    loadParticipantStatuses();
    loadAllParticipants();
    const interval = setInterval(loadQueues, 2500);
    return () => clearInterval(interval);
  }, [loadQueues, loadStores]);

  // Load all participants for commander queues
  const loadAllParticipants = async () => {
    console.log('CommanderQueues: Loading all participants for queues');

    const { data: participants, error } = await supabase
      .from('queue_participants')
      .select('queue_id, status, joined_at, user_id')
      .neq('status', 'withdrawn');

    if (error) {
      console.error('CommanderQueues: Error loading participants:', error);
      return;
    }

    console.log('CommanderQueues: Found all participants:', participants);

    if (participants) {
      const participantsByQueue: Record<number, Array<{ status: 'enroute' | 'at_store'; joined_at: string; user_id: string }>> = {};
      participants.forEach((p: any) => {
        if (!participantsByQueue[p.queue_id]) {
          participantsByQueue[p.queue_id] = [];
        }
        participantsByQueue[p.queue_id].push({
          status: p.status,
          joined_at: p.joined_at,
          user_id: p.user_id
        });
      });
      setAllParticipants(participantsByQueue);
    }
  };

  // Load participant status for joined commander queues
  const loadParticipantStatuses = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('CommanderQueues: No user ID for participant status loading');
      return;
    }

    console.log('CommanderQueues: Loading participant status for user:', userId);

    const { data: participants, error } = await supabase
      .from('queue_participants')
      .select('queue_id, status, joined_at')
      .eq('user_id', userId)
      .neq('status', 'withdrawn');

    if (error) {
      console.error('CommanderQueues: Error loading participant status:', error);
      return;
    }

    console.log('CommanderQueues: Found participants:', participants);

    if (participants) {
      const statuses: Record<number, { status: 'enroute' | 'at_store'; joined_at: string }> = {};
      participants.forEach((p: any) => {
        console.log('CommanderQueues: Setting status for queue', p.queue_id, ':', p.status);
        statuses[p.queue_id] = {
          status: p.status,
          joined_at: p.joined_at
        };
      });
      console.log('CommanderQueues: Final statuses:', statuses);
      setParticipantStatuses(statuses);
    } else {
      console.log('CommanderQueues: No participants found for user');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Companion code ${code} copied to clipboard!`);
  };

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
        type: 'commander',
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
      writeNumberList(joinedKey, [...readNumberList(joinedKey, userId), newQueue.id], userId);
      writeNumberList(withdrawnKey, readNumberList(withdrawnKey, userId).filter((id) => id !== newQueue.id), userId);
      setJoinedIds(readNumberList(joinedKey, userId));
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

    writeNumberList(joinedKey, [...readNumberList(joinedKey, userId), queue.id], userId);
    writeNumberList(withdrawnKey, readNumberList(withdrawnKey, userId).filter((id) => id !== queue.id), userId);
    setJoinedIds(readNumberList(joinedKey, userId));
    loadQueues();
  };

  const withdrawQueue = async (queue: CommanderQueue) => {
    if (!confirm('Withdraw from this Commander queue?')) return;

    writeNumberList(joinedKey, readNumberList(joinedKey, userId).filter((id) => id !== queue.id), userId);
    writeNumberList(withdrawnKey, [...readNumberList(withdrawnKey, userId), queue.id], userId);
    setJoinedIds(readNumberList(joinedKey, userId));
    setQueues((current) => current.filter((q) => q.id !== queue.id));

    // Delete participant record from database
    const { error: deleteError } = await supabase
      .from('queue_participants')
      .delete()
      .eq('queue_id', queue.id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting participant record:', deleteError);
    }

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

    writeNumberList(joinedKey, [...readNumberList(joinedKey, userId), queue.id], userId);
    writeNumberList(withdrawnKey, readNumberList(withdrawnKey, userId).filter((id) => id !== queue.id), userId);
    setJoinedIds(readNumberList(joinedKey, userId));
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

                    {(() => {
                    console.log('CommanderQueues: Checking status for queue', q.id, 'in participantStatuses:', participantStatuses);
                    const hasStatus = participantStatuses[q.id];
                    console.log('CommanderQueues: Has status for queue', q.id, ':', hasStatus);
                    return hasStatus;
                  })() && (
                      <div className="mb-3 p-2 bg-zinc-800 rounded-lg text-sm">
                        <p className="text-zinc-400 mb-1">Your Status:</p>
                        <p className="font-medium">
                          {participantStatuses[q.id].status === 'at_store' ? (
                            <span className="text-green-400">🟢 At Store</span>
                          ) : (
                            <span className="text-yellow-400">🟡 Enroute</span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Joined: {new Date(participantStatuses[q.id].joined_at).toLocaleTimeString()}
                        </p>
                      </div>
                    )}

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
              
              {allParticipants[queue.id] && (
                <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
                  <p className="text-sm text-zinc-400 mb-2">Players in this pod:</p>
                  {allParticipants[queue.id].map((participant, index) => (
                    <div key={index} className="flex items-center justify-between py-1 border-b border-zinc-700 last:border-0">
                      <span className="text-sm">
                        User-{participant.user_id.slice(0, 8)}
                      </span>
                      <span className="text-sm font-medium">
                        {participant.status === 'at_store' ? (
                          <span className="text-green-400">🟢 At Store</span>
                        ) : (
                          <span className="text-yellow-400">🟡 Enroute</span>
                        )}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(participant.joined_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
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
