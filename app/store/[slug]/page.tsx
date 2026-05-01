// app/store/[slug]/page.tsx
'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { getDistance } from '@/utils/distance';
import CreateDraftQueue from '@/components/CreateDraftQueue';

const priceOptions = [20, 25, 30, 35, 40, "TBD"];
const STORE_PASSWORD = "1234";   // ← Change this anytime

export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [store, setStore] = useState<any>(null);
  const [queues, setQueues] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Password Protection
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState('');

  // Approval modal
  const [approvingRequest, setApprovingRequest] = useState<any>(null);
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<string | number>('');

  const checkPassword = () => {
    if (passwordAttempt === STORE_PASSWORD) {
      setIsAuthenticated(true);
      loadStoreData();
    } else {
      alert("Incorrect password. Try again.");
      setPasswordAttempt('');
    }
  };

  const loadStoreData = async () => {
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single();

    setStore(storeData);
    if (storeData) {
      loadQueues(storeData.id);
      loadPendingRequests(storeData.id);
      subscribeToChanges(storeData.id);
    }
    setLoading(false);
  };

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log('Location access denied')
    );
  }, []);

  const loadQueues = async (storeId: number) => {
    const { data } = await supabase
      .from('draft_queues')
      .select('*')
      .eq('store_id', storeId)
      .order('queue_number');
    setQueues(data || []);
  };

  const loadPendingRequests = async (storeId: number) => {
    const { data } = await supabase
      .from('draft_requests')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'pending');
    setPendingRequests(data || []);
  };

  const subscribeToChanges = (storeId: number) => {
    supabase.channel(`store-data-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_queues', filter: `store_id=eq.${storeId}` }, () => loadQueues(storeId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_requests', filter: `store_id=eq.${storeId}` }, () => loadPendingRequests(storeId))
      .subscribe();
  };

  const busyPercent = store 
    ? Math.round(((store.current_players || 0) / (store.max_capacity || 40)) * 100) 
    : 0;

  const approveRequest = (req: any) => {
    setApprovingRequest(req);
    setSelectedType(req.label || '');
    setSelectedPrice('');
  };

  const confirmApproval = async () => {
    if (!approvingRequest || !selectedType || !selectedPrice) return;

    const priceText = selectedPrice === 'TBD' ? 'TBD' : `$${selectedPrice}`;
    const finalLabel = `${selectedType} - ${priceText} (Player Requested)`;

    const { data: existing } = await supabase
      .from('draft_queues')
      .select('queue_number')
      .eq('store_id', store.id)
      .order('queue_number', { ascending: false })
      .limit(1);

    const nextNumber = (existing?.[0]?.queue_number || 0) + 1;

    await supabase.from('draft_queues').insert({
      store_id: store.id,
      current_count: 1,
      status: 'open',
      players: [],
      queue_number: nextNumber,
      label: finalLabel
    });

    await supabase.from('draft_requests').update({ status: 'approved' }).eq('id', approvingRequest.id);

    alert(`✅ Queue #${nextNumber} created!\n${finalLabel}`);

    loadQueues(store.id);
    loadPendingRequests(store.id);

    if (typeof window !== 'undefined') {
      if ((window as any).refreshOtherQueues) (window as any).refreshOtherQueues();
      if ((window as any).refreshMyQueues) (window as any).refreshMyQueues();
    }

    setApprovingRequest(null);
    setSelectedType('');
    setSelectedPrice('');
  };

  const denyRequest = async (requestId: number) => {
    if (!confirm("Deny this request?")) return;
    await supabase.from('draft_requests').update({ status: 'denied' }).eq('id', requestId);
    loadPendingRequests(store.id);
  };

  const markFiring = async (queueId: number) => {
    const label = prompt("Enter label/time (e.g. Table 1 at 3pm):", "");
    const code = prompt("Enter the 6-digit companion code:", 
      Math.floor(100000 + Math.random() * 900000).toString());

    if (!code || code.length !== 6) {
      alert("Please enter a valid 6-digit code");
      return;
    }

    await supabase
      .from('draft_queues')
      .update({ 
        status: 'firing',
        firing_code: code,
        label: label.trim() || null 
      })
      .eq('id', queueId);

    loadQueues(store.id);
  };

  const markCanceled = async (queueId: number) => {
    if (!confirm("Mark as Canceled?")) return;
    await supabase.from('draft_queues').update({ status: 'canceled' }).eq('id', queueId);
    loadQueues(store.id);
  };

  const markCompleted = async (queueId: number) => {
    if (!confirm("Mark as Completed?")) return;
    await supabase.from('draft_queues').update({ status: 'completed' }).eq('id', queueId);
    loadQueues(store.id);
  };

  const clearAllQueues = async () => {
    if (!confirm("WARNING: Permanently delete ALL queues?")) return;
    await supabase.from('draft_queues').delete().eq('store_id', store.id);
    loadQueues(store.id);
  };

  // ==================== PASSWORD SCREEN ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="bg-zinc-900 p-10 rounded-3xl max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-8">Store Dashboard</h1>
          <p className="mb-6 text-zinc-400">Enter Password</p>
          
          <input
            type="password"
            value={passwordAttempt}
            onChange={(e) => setPasswordAttempt(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && checkPassword()}
            className="w-full p-5 bg-zinc-800 rounded-2xl text-center text-3xl mb-6"
            placeholder="••••"
          />

          <button
            onClick={checkPassword}
            className="w-full bg-amber-600 hover:bg-amber-700 py-4 rounded-2xl font-bold text-lg"
          >
            Unlock Dashboard
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="mt-8 text-zinc-400 hover:text-white text-sm"
          >
            ← Back to Player App
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN DASHBOARD ====================
  if (loading) return <div className="p-8 text-center text-xl">Loading store...</div>;
  if (!store) return <div className="p-8 text-center text-xl">Store not found</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">{store.name}</h1>
        <button
          onClick={() => window.location.href = '/'}
          className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-xl font-medium"
        >
          ← Back to Player App
        </button>
      </div>

      {userLocation && store.lat && store.lng && (
        <p className="text-lg opacity-80 mb-6">
          📍 {Math.round(getDistance(userLocation.lat, userLocation.lng, store.lat, store.lng))} miles away
        </p>
      )}

      <div className="bg-zinc-900 p-6 rounded-3xl mb-8">
        <h2 className="text-2xl mb-2">Current Status</h2>
        <div className="text-5xl font-bold text-green-400">{busyPercent}% FULL</div>
      </div>

      <button onClick={clearAllQueues} className="bg-red-600 px-6 py-3 rounded-xl mb-6 font-bold">
        Clear All Queues
      </button>

      {/* Pending Player Requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">📬 Pending Player Requests</h2>
          {pendingRequests.map((req) => (
            <div key={req.id} className="bg-zinc-800 p-6 rounded-3xl mb-6 border border-orange-500/30">
              <p className="text-lg font-medium">{req.label}</p>
              {req.notes && <p className="text-sm text-zinc-400 mt-2">{req.notes}</p>}
              <div className="flex gap-3 mt-5">
                <button 
                  onClick={() => approveRequest(req)}
                  className="flex-1 bg-green-600 py-3 rounded-xl font-bold"
                >
                  Approve & Set Details
                </button>
                <button 
                  onClick={() => denyRequest(req.id)}
                  className="flex-1 bg-red-600 py-3 rounded-xl font-bold"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {approvingRequest && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-3xl font-bold mb-6">Approve Player Request</h2>
            <p className="text-zinc-400 mb-6">Original: {approvingRequest.label}</p>

            <p className="text-zinc-400 mb-3">Draft Type</p>
            <input
              type="text"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-4 bg-zinc-800 rounded-2xl mb-6"
            />

            <p className="text-zinc-400 mb-3">Price</p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {priceOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPrice(p)}
                  className={`p-4 rounded-2xl font-bold transition ${
                    selectedPrice === p ? 'bg-green-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {p === 'TBD' ? 'TBD' : '$' + p}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setApprovingRequest(null)} className="flex-1 py-4 bg-zinc-700 rounded-2xl font-bold">
                Cancel
              </button>
              <button 
                onClick={confirmApproval}
                disabled={!selectedType || !selectedPrice}
                className="flex-1 py-4 bg-green-600 rounded-2xl font-bold disabled:opacity-50"
              >
                Approve & Create Queue
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-3xl font-bold mb-6">Live Draft Queues</h2>
      {queues.length === 0 ? (
        <p className="text-zinc-400 mb-6">No queues yet</p>
      ) : (
        queues.map((q) => (
          <div key={q.id} className="bg-zinc-800 p-6 rounded-3xl mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-4xl font-bold">{q.current_count}/8</div>
                <p className="text-sm opacity-70">
                  Queue #{q.queue_number} • <span className="capitalize">{q.status}</span>
                </p>
                {q.label && <p className="text-yellow-400 mt-1">{q.label}</p>}
              </div>

              <div className="flex gap-2 flex-wrap">
                {q.status === 'open' && (
                  <button onClick={() => markFiring(q.id)} className="bg-orange-600 px-6 py-3 rounded-xl text-sm font-bold">
                    Mark as Firing
                  </button>
                )}
                <button onClick={() => markCanceled(q.id)} className="bg-red-600 px-6 py-3 rounded-xl text-sm font-bold">
                  Cancel
                </button>
                <button onClick={() => markCompleted(q.id)} className="bg-green-600 px-6 py-3 rounded-xl text-sm font-bold">
                  Completed
                </button>
              </div>
            </div>

            {q.firing_code && (
              <div className="p-4 bg-black rounded-xl text-2xl font-mono text-center">
                Companion Code: {q.firing_code}
              </div>
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