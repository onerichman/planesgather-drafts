// components/QuickDraftFinder.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getDistance } from '@/utils/distance';
import PhoneOptInModal from './PhoneOptInModal';

export default function QuickDraftFinder() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [queues, setQueues] = useState<any[]>([]);
  const [showOptIn, setShowOptIn] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMessage("Please allow location access")
    );
  }, []);

  const findNearbyDrafts = async () => {
    if (!location) {
      setMessage("Location is required");
      return;
    }

    setLoading(true);
    setMessage("Searching...");

    const { data, error } = await supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name, slug, lat, lng, max_capacity, current_players)
      `)
      .eq('status', 'open')
      .lt('current_count', 8);

    setLoading(false);

    if (error) {
      console.error(error);
      setMessage("Error loading data");
      return;
    }

    if (!data || data.length === 0) {
      setMessage("No open queues found");
      setQueues([]);
      return;
    }

    const filtered = data.filter((q: any) => {
      if (!q.stores?.lat || !q.stores?.lng) return false;
      const dist = getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng);
      return dist <= 100; // 100 miles for testing
    });

    setQueues(filtered);
    setMessage(filtered.length === 0 ? "No drafts within 100 miles" : "");
  };

  const attemptJoin = (queueId: number) => {
    setSelectedQueueId(queueId);
    setShowOptIn(true);
  };

  const handleOptInSuccess = async () => {
    if (!selectedQueueId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please sign in");
      return;
    }

    // Get current queue data
    const { data: currentQueue } = await supabase
      .from('draft_queues')
      .select('players, current_count')
      .eq('id', selectedQueueId)
      .single();

    if (!currentQueue) {
      alert("Queue not found");
      return;
    }

    const newPlayers = [...(currentQueue.players || []), user.id];
    const newCount = (currentQueue.current_count || 0) + 1;

    const { error } = await supabase
      .from('draft_queues')
      .update({
        players: newPlayers,
        current_count: newCount
      })
      .eq('id', selectedQueueId);

    if (error) {
      alert("Failed to join queue: " + error.message);
    } else {
      alert("Successfully joined the queue!");
      setShowOptIn(false);
      setQueues([]);
      findNearbyDrafts(); // refresh list
    }
  };

  return (
    <>
      <div className="px-8 mt-8">
        <button
          onClick={findNearbyDrafts}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl text-2xl font-bold flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
        >
          {loading ? 'Searching...' : '⚡ Find Drafts Near Me'}
        </button>
      </div>

      {message && <div className="px-8 mt-4 text-center text-zinc-400">{message}</div>}

      {queues.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <h2 className="text-3xl font-bold mb-6">Drafts Nearby</h2>
            {queues.map((q) => (
              <div key={q.id} className="bg-zinc-800 p-6 rounded-2xl mb-6">
                <h3 className="text-xl font-semibold">{q.stores.name}</h3>
                <p className="text-sm opacity-70">
                  {Math.round(getDistance(location!.lat, location!.lng, q.stores.lat, q.stores.lng))} miles away
                </p>
                <div className="text-5xl font-bold my-4 text-green-400">
                  {q.current_count} / 8
                </div>
                <button
                  onClick={() => attemptJoin(q.id)}
                  className="w-full bg-green-600 py-5 rounded-xl font-bold text-lg"
                >
                  Join Queue
                </button>
              </div>
            ))}
            <button onClick={() => setQueues([])} className="w-full text-zinc-400 py-3">
              Close
            </button>
          </div>
        </div>
      )}

      {showOptIn && (
        <PhoneOptInModal
          onOptIn={handleOptInSuccess}
          onCancel={() => setShowOptIn(false)}
        />
      )}
    </>
  );
}