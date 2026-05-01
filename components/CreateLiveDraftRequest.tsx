// components/CreateLiveDraftRequest.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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

export default function CreateLiveDraftRequest() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        loadNearbyStores(pos.coords.latitude, pos.coords.longitude);
      },
      () => console.log("Location access denied")
    );
  }, []);

  const loadNearbyStores = async (lat: number, lng: number) => {
    const { data } = await supabase.from('stores').select('*');
    const sorted = (data || []).sort((a: any, b: any) => {
      const distA = getDistance(lat, lng, a.lat, a.lng);
      const distB = getDistance(lat, lng, b.lat, b.lng);
      return distA - distB;
    }).slice(0, 10);
    setStores(sorted);
  };

  const createRequest = async () => {
    if (!selectedStoreId || !selectedType) {
      alert("Please select a store and draft type");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('draft_requests').insert({
      store_id: selectedStoreId,
      label: selectedType,
      notes: notes.trim() || null,
      status: 'pending'
    });

    setLoading(false);

    if (error) {
      alert("Error sending request: " + error.message);
    } else {
      alert("✅ Request sent to the store! Waiting for approval...");
      setShowModal(false);
      setSelectedStoreId(null);
      setSelectedType('');
      setNotes('');
    }
  };

  // Realtime listener for approvals
  useEffect(() => {
    const channel = supabase
      .channel('request-approvals-v2')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'draft_requests' },
        (payload) => {
          if (payload.new?.status === 'approved') {
            setSuccessMessage("✅ Your draft request was approved! You have been auto-added to the queue.");
            setTimeout(() => setSuccessMessage(''), 8000);

            // Force refresh
            if (typeof window !== 'undefined') {
              if ((window as any).refreshMyQueues) (window as any).refreshMyQueues();
              if ((window as any).refreshOtherQueues) (window as any).refreshOtherQueues();
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Manual Refresh Button
  const manualRefresh = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).refreshMyQueues) (window as any).refreshMyQueues();
      if ((window as any).refreshOtherQueues) (window as any).refreshOtherQueues();
    }
    setSuccessMessage("🔄 Refreshed queues. Check Your Active Queues.");
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  return (
    <>
      <div className="px-8 mt-8 flex gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 bg-purple-600 hover:bg-purple-700 py-5 rounded-2xl text-lg font-bold"
        >
          ✨ Create Live Draft Request
        </button>
        <button
          onClick={manualRefresh}
          className="px-6 bg-zinc-700 hover:bg-zinc-600 rounded-2xl text-sm font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Success / Status Message */}
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
              {stores.map((store: any) => (
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