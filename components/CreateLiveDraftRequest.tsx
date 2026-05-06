// components/CreateLiveDraftRequest.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId, readNumberList, writeNumberList } from '@/utils/storage';
import { getDistance } from '@/utils/distance';

const draftTypes = [
  "Aetherdrift Draft",
  "Bloomburrow Draft",
  "Foundations Draft",
  "Modern Horizons Draft",
  "Chaos Draft",
  "Majority Rule Vote",
  "Custom / Mystery Draft",
  "Other"
];

type Store = {
  id: number;
  name: string;
  lat: number;
  lng: number;
};

type DraftRequest = {
  id: number;
  status: string;
  notes: string | null;
};

const pendingRequestStorageKey = 'pendingDraftRequestIds';


const extractApprovedQueueId = (notes: string | null) => {
  const match = notes?.match(/approved_queue_id:(\d+)/);
  return match ? Number(match[1]) : null;
};

const extractDeniedReason = (notes: string | null) => {
  const match = notes?.match(/denied_reason:([^\n]+)/);
  return match ? match[1] : null;
};

export default function CreateLiveDraftRequest() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState('');
  const [notes, setNotes] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const loadNearbyStores = useCallback(async (lat: number, lng: number) => {
    const { data } = await supabase.from('stores').select('*');
    const sorted = ((data || []) as Store[]).sort((a, b) => {
      const distA = getDistance(lat, lng, a.lat, a.lng);
      const distB = getDistance(lat, lng, b.lat, b.lng);
      return distA - distB;
    }).slice(0, 10);
    setStores(sorted);
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        loadNearbyStores(pos.coords.latitude, pos.coords.longitude);
      },
      () => console.log("Location access denied")
    );
  }, [loadNearbyStores]);

  const createRequest = async () => {
    if (!selectedStoreId || !selectedType) {
      alert("Please select a store and draft type");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.from('draft_requests').insert({
      store_id: selectedStoreId,
      label: selectedType,
      notes: notes.trim() || null,
      status: 'pending'
    }).select('id').single();

    setLoading(false);

    if (error) {
      alert("Error: " + error.message);
    } else {
      if (data?.id) {
        writeNumberList(pendingRequestStorageKey, [
          ...readNumberList(pendingRequestStorageKey, userId),
          data.id,
        ], userId);
      }

      alert("✅ Request sent to the store! Waiting for approval...");
      setShowModal(false);
      setSelectedStoreId(null);
      setSelectedType('');
      setNotes('');
    }
  };

  const addJoinedQueue = useCallback((queueId: number) => {
    const joined = readNumberList('joinedQueueIds', userId);
    if (!joined.includes(queueId)) {
      writeNumberList('joinedQueueIds', [...joined, queueId], userId);
      window.dispatchEvent(new CustomEvent('joinedQueuesChanged'));
      console.log("✅ Auto-added approved queue to localStorage:", queueId);
    }

    setSuccessMessage("✅ Your draft request was approved! You have been auto-added to the queue.");
    setTimeout(() => setSuccessMessage(''), 8000);
    window.refreshMyQueues?.();
    window.refreshOtherQueues?.();
  }, [userId]);

  const checkApprovedRequests = useCallback(async () => {
    const pendingIds = readNumberList(pendingRequestStorageKey, userId);
    if (pendingIds.length === 0) return;

    const { data } = await supabase
      .from('draft_requests')
      .select('id, status, notes')
      .in('id', pendingIds);

    const requests = (data || []) as DraftRequest[];
    const stillPending: number[] = [];

    for (const request of requests) {
      const queueId = request.status === 'approved' ? extractApprovedQueueId(request.notes) : null;
      if (queueId) {
        addJoinedQueue(queueId);
      } else if (request.status === 'denied') {
        const reason = extractDeniedReason(request.notes);
        setSuccessMessage(`Your draft request was denied${reason ? `: ${reason}` : ''}.`);
        setTimeout(() => setSuccessMessage(''), 10000);
      } else if (request.status === 'pending') {
        stillPending.push(request.id);
      }
    }

    writeNumberList(pendingRequestStorageKey, stillPending, userId);
  }, [addJoinedQueue, userId]);

  // Listen for store approval and add to localStorage
  useEffect(() => {
    const handleQueueApproved = (e: Event) => {
      const queueId = (e as CustomEvent<number>).detail;
      if (!queueId) return;
      addJoinedQueue(queueId);

      const joined = readNumberList('joinedQueueIds', userId);
      if (!joined.includes(queueId)) {
        writeNumberList('joinedQueueIds', [...joined, queueId], userId);
        window.dispatchEvent(new CustomEvent('joinedQueuesChanged'));
        console.log("✅ Auto-added approved queue to localStorage:", queueId);
      }

      setSuccessMessage("✅ Your draft request was approved! You have been auto-added to the queue.");
      setTimeout(() => setSuccessMessage(''), 8000);

      if (typeof window !== 'undefined') {
        window.refreshMyQueues?.();
        window.refreshOtherQueues?.();
      }
    };

    window.addEventListener('queueApproved', handleQueueApproved);

    return () => window.removeEventListener('queueApproved', handleQueueApproved);
  }, [addJoinedQueue, userId]);

  useEffect(() => {
    const loadUser = async () => {
      setUserId(await getCurrentUserId());
    };
    loadUser();
    checkApprovedRequests();
    const interval = setInterval(checkApprovedRequests, 3000);
    return () => clearInterval(interval);
  }, [checkApprovedRequests]);

  return (
    <>
      <div className="px-8 mt-8">
        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-purple-600 hover:bg-purple-700 py-5 rounded-2xl text-lg font-bold"
        >
          ✨ Create Live Draft Request
        </button>
      </div>

      {successMessage && (
        <div className="mx-8 mt-6 p-5 bg-green-900 border border-green-500 text-green-100 rounded-2xl text-center font-medium">
          {successMessage}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-3xl font-bold mb-6 text-center">Create Live Draft Request</h2>

            <p className="text-zinc-400 mb-3">Which store are you at?</p>
            <div className="space-y-2 mb-8 max-h-64 overflow-y-auto pr-2">
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
                  className={`w-full p-4 rounded-2xl text-left transition-all ${
                    selectedStoreId === store.id ? 'bg-green-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {store.name}
                  <span className="text-sm block opacity-70">
                    {location && Math.round(getDistance(location.lat, location.lng, store.lat, store.lng))} miles away
                  </span>
                </button>
              ))}
            </div>

            <p className="text-zinc-400 mb-3">What draft are you looking for?</p>
            <div className="space-y-2 mb-8 max-h-64 overflow-y-auto pr-2">
              {draftTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`w-full p-4 rounded-2xl text-left transition-all ${
                    selectedType === type ? 'bg-green-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Additional notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-4 bg-zinc-800 rounded-2xl h-24 mb-8"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 bg-zinc-700 rounded-2xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={createRequest}
                disabled={loading || !selectedStoreId || !selectedType}
                className="flex-1 py-4 bg-purple-600 rounded-2xl font-bold disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Request to Store'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
