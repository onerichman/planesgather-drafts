// app/store/[slug]/page.tsx
'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { getDistance } from '@/utils/distance';
import CreateDraftQueue from '@/components/CreateDraftQueue';
import VoteAndPay from '@/components/VoteAndPay';

export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [store, setStore] = useState<any>(null);
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log('Location access denied')
    );

    if (!slug) return;

    supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error || !data) {
          setError(`Store "${slug}" not found.`);
          return;
        }
        setStore(data);
        loadQueues(data.id);
      });
  }, [slug]);

  const loadQueues = async (storeId: number) => {
    const { data } = await supabase
      .from('draft_queues')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'open');
    setQueues(data || []);
  };

  const busyPercent = store 
    ? Math.round((store.current_players / store.max_capacity) * 100) 
    : 0;

  if (loading) return <div className="p-8 text-center text-xl">Loading store...</div>;
  if (error) return <div className="p-8 text-center text-red-400 text-xl">{error}</div>;
  if (!store) return <div className="p-8 text-center text-xl">Store not found</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-4xl font-bold mb-2">{store.name}</h1>
      
      {userLocation && store.lat && store.lng && (
        <p className="text-lg opacity-80 mb-6">
          📍 {Math.round(getDistance(userLocation.lat, userLocation.lng, store.lat, store.lng))} miles away
        </p>
      )}

      <div className="bg-zinc-900 p-6 rounded-3xl mb-8">
        <h2 className="text-2xl mb-2">Current Status</h2>
        <div className="text-5xl font-bold text-green-400">{busyPercent}% FULL</div>
        <p className="text-lg mt-2">
          {store.current_players} / {store.max_capacity} players
        </p>
      </div>

      <h2 className="text-3xl font-bold mb-4">Live Draft Queues</h2>
      {queues.length === 0 ? (
        <p className="text-zinc-400 mb-6">No open queues yet</p>
      ) : (
        queues.map((q) => (
          <div key={q.id} className="bg-zinc-800 p-6 rounded-3xl mb-8">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-4xl font-bold">{q.current_count}/8</div>
                <p className="text-sm opacity-70">in queue</p>
              </div>
              <button className="bg-red-600 px-8 py-4 rounded-xl font-bold">
                Join
              </button>
            </div>

            {/* Show voting if queue is full */}
            {q.current_count >= 8 && (
              <VoteAndPay 
                queueId={q.id} 
                onVoted={() => loadQueues(store.id)} 
              />
            )}
          </div>
        ))
      )}

      <CreateDraftQueue 
        storeId={store.id} 
        onCreated={() => loadQueues(store.id)} 
      />
    </div>
  );
}