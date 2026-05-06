// components/QuickDraftFinder.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getDistance } from '@/utils/distance';
import { getCurrentUserId, readNumberList, writeNumberList } from '@/utils/storage';
import PhoneOptInModal from './PhoneOptInModal';

type NearbyQueue = {
  id: number;
  current_count: number;
  queue_number: number;
  label: string | null;
  stores: {
    name: string;
    slug: string;
    lat: number;
    lng: number;
  };
};

export default function QuickDraftFinder() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string | null>(null);
  const [skipPhonePrompt, setSkipPhonePrompt] = useState(false);
  const [queues, setQueues] = useState<NearbyQueue[]>([]);
  const [joinedQueueIds, setJoinedQueueIds] = useState<number[]>([]);
  const [showOptIn, setShowOptIn] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load joined queues from localStorage per current user
  useEffect(() => {
    const loadUser = async () => {
      const userResult = await getCurrentUserId();
      setUserId(userResult);
      setJoinedQueueIds(readNumberList('joinedQueueIds', userResult));

      if (userResult) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number, skip_phone_prompt')
          .eq('id', userResult)
          .single();

        setUserPhoneNumber(profile?.phone_number || null);
        setSkipPhonePrompt(Boolean(profile?.skip_phone_prompt));
      }
    };

    loadUser();
    const syncJoinedQueues = () => setJoinedQueueIds(readNumberList('joinedQueueIds', userId));
    window.addEventListener('joinedQueuesChanged', syncJoinedQueues);
    return () => window.removeEventListener('joinedQueuesChanged', syncJoinedQueues);
  }, [userId]);

  // Remove the useEffect that saves to localStorage - let other components handle this
  // useEffect(() => {
  //   localStorage.setItem('joinedQueueIds', JSON.stringify(joinedQueueIds));
  // }, [joinedQueueIds]);

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMessage("Please allow location access")
    );
  }, []);

  // Listen for "Join Now" button clicks from OtherActiveQueues
  useEffect(() => {
    const handleJoinEvent = (e: Event) => {
      const queueId = (e as CustomEvent<number>).detail;
      if (joinedQueueIds.includes(queueId)) {
        alert("You are already in this queue!");
        return;
      }
      setSelectedQueueId(queueId);
      setShowOptIn(true);
    };
    window.addEventListener('joinQueue', handleJoinEvent);
    return () => window.removeEventListener('joinQueue', handleJoinEvent);
  }, [joinedQueueIds]);

  // Listen for player requests approved by store
  useEffect(() => {
    const handleQueueApproved = (e: Event) => {
      const queueId = (e as CustomEvent<number>).detail;
      if (queueId && !joinedQueueIds.includes(queueId)) {
        const newList = [...joinedQueueIds, queueId];
        setJoinedQueueIds(newList);
        writeNumberList('joinedQueueIds', newList, userId);
        window.dispatchEvent(new CustomEvent('joinedQueuesChanged'));
        console.log("✅ Auto-added approved queue:", queueId);
      }
    };
    window.addEventListener('queueApproved', handleQueueApproved);
    return () => window.removeEventListener('queueApproved', handleQueueApproved);
  }, [joinedQueueIds]);

  const findNearbyDrafts = async () => {
    if (!location) return;

    setLoading(true);
    setMessage("Searching...");

    const { data } = await supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name, slug, lat, lng)
      `)
      .in('status', ['open', 'firing']);

    setLoading(false);

    const filtered = ((data || []) as unknown as NearbyQueue[]).filter((q) => {
      if (!q.stores?.lat || !q.stores?.lng) return false;
      // Exclude commander pods - only show draft queues
      if (q.label && q.label.toLowerCase().includes('commander')) return false;
      const dist = getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng);
      return dist <= 100;
    });

    setQueues(filtered);
    setMessage(filtered.length === 0 ? "No drafts within 100 miles" : "");
  };

  const joinSelectedQueue = async (queueId: number) => {
    const { data: q } = await supabase
      .from('draft_queues')
      .select('current_count')
      .eq('id', queueId)
      .single();

    const newCount = (q?.current_count || 0) + 1;

    await supabase
      .from('draft_queues')
      .update({ current_count: newCount })
      .eq('id', queueId);

    const newJoinedList = [...joinedQueueIds, queueId];
    setJoinedQueueIds(newJoinedList);
    writeNumberList('joinedQueueIds', newJoinedList, userId);
    writeNumberList(
      'withdrawnQueueIds',
      readNumberList('withdrawnQueueIds', userId).filter((id) => id !== queueId),
      userId
    );
    window.dispatchEvent(new CustomEvent('joinedQueuesChanged'));

    console.log("✅ Saved joined queues:", newJoinedList);

    await findNearbyDrafts();

    if (typeof window !== 'undefined') {
      window.refreshMyQueues?.();
      window.refreshOtherQueues?.();
    }

    setShowOptIn(false);
    setShowSuccess(true);
  };

  function attemptJoin(queueId: number) {
    if (joinedQueueIds.includes(queueId)) {
      alert("You are already in this queue!");
      return;
    }

    setSelectedQueueId(queueId);

    if (skipPhonePrompt || Boolean(userPhoneNumber)) {
      joinSelectedQueue(queueId);
      return;
    }

    setShowOptIn(true);
  }

  const handleOptInSuccess = async () => {
    if (!selectedQueueId) return;
    await joinSelectedQueue(selectedQueueId);
  };

  const closeSuccess = () => {
    setShowSuccess(false);
    setQueues([]);
  };

  const closeNearbyModal = () => {
    setQueues([]);
    setMessage("");
  };

  return (
    <>
      <div className="px-8 mt-8">
        <button 
          onClick={findNearbyDrafts} 
          disabled={loading} 
          className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl text-2xl font-bold"
        >
          {loading ? 'Searching...' : '⚡ Find Drafts Near Me'}
        </button>
      </div>

      {message && <div className="px-8 mt-4 text-center text-zinc-400">{message}</div>}

      {queues.length > 0 && !showSuccess && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">Drafts Nearby</h2>
              <button onClick={closeNearbyModal} className="text-2xl text-zinc-400 hover:text-white">✕</button>
            </div>
            
            {queues.map((q) => {
              const alreadyJoined = joinedQueueIds.includes(q.id) || q.current_count > 0;
              return (
                <div key={q.id} className="bg-zinc-800 p-6 rounded-2xl mb-6">
                  <h3 className="text-xl font-semibold">{q.stores.name}</h3>
                  <p className="text-sm opacity-70">
                    Queue #{q.queue_number} • {location && Math.round(getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng))} miles
                  </p>
                  <div className="text-5xl font-bold my-4 text-green-400">
                    {q.current_count} / 8
                  </div>
                  {q.label && <p className="text-yellow-400 mb-4">{q.label}</p>}

                  <button
                    onClick={() => attemptJoin(q.id)}
                    disabled={alreadyJoined}
                    className={`w-full py-5 rounded-xl font-bold text-lg transition ${
                      alreadyJoined ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {alreadyJoined ? '✅ Already Joined' : 'Join Queue'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showOptIn && <PhoneOptInModal onOptIn={handleOptInSuccess} onCancel={() => setShowOptIn(false)} />}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-10 max-w-md w-full text-center">
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-3xl font-bold mb-4">You&apos;re In!</h2>
            <button onClick={closeSuccess} className="w-full bg-green-600 py-5 rounded-2xl font-bold text-lg">
              Return to Main Screen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
