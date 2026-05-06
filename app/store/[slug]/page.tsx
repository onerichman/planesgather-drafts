// app/store/[slug]/page.tsx
'use client';
import { useEffect, useRef, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { getDistance } from '@/utils/distance';
import CreateDraftQueue from '@/components/CreateDraftQueue';
import QrScanner from 'qr-scanner';

const priceOptions = [20, 25, 30, 35, 40, "TBD"];

type Store = {
  id: number;
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  current_players: number | null;
  max_capacity: number | null;
};

type DraftQueue = {
  id: number;
  current_count: number;
  status: string;
  firing_code: string | null;
  queue_number: number;
  label: string | null;
};

type CommanderQueue = {
  id: number;
  current_count: number;
  status: string;
  firing_code: string | null;
  queue_number: number;
  label: string | null;
};

type DraftRequest = {
  id: number;
  label: string | null;
  notes: string | null;
};

type RealtimeDraftRequestPayload = {
  eventType: string;
  new?: Partial<DraftRequest> & { status?: string };
};

const generateCompanionCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
const denialReasons = ["Too busy", "Another event", "Too close to store closing"];

export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [store, setStore] = useState<Store | null>(null);
  const [draftQueues, setDraftQueues] = useState<DraftQueue[]>([]);
  const [commanderQueues, setCommanderQueues] = useState<CommanderQueue[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DraftRequest[]>([]);
  const [requestNotice, setRequestNotice] = useState('');
  const [storeError, setStoreError] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Approval modal
  const [approvingRequest, setApprovingRequest] = useState<DraftRequest | null>(null);
  const [denyingRequest, setDenyingRequest] = useState<DraftRequest | null>(null);
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<string | number>('');
  const [qrModal, setQrModal] = useState<{ code: string; link: string } | null>(null);
  const [qrScannerModal, setQrScannerModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [selectedEntryMethod, setSelectedEntryMethod] = useState<'manual' | 'scan' | null>(null);
  const [manualJoinCode, setManualJoinCode] = useState('');
  const [pendingQueueId, setPendingQueueId] = useState<number | null>(null);
  const [joinNowLinks, setJoinNowLinks] = useState<Array<{ id: string; label: string; deepLink: string; fallback: string }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const pendingRequestIdsRef = useRef<Set<number>>(new Set());

  const checkAuthorization = async () => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setStoreError('You must be signed in to access the store dashboard.');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Get user profile to check if they're a store owner
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        setStoreError('Could not verify your account type.');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Check if user is a store owner
      if (profile.user_type !== 'store') {
        setStoreError('Only store owners can access this dashboard. Please log in with a store account.');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Load the store by slug
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (storeError || !storeData) {
        setStoreError('Store not found.');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Check if user owns this store
      if (storeData.owner_id !== session.user.id) {
        setStoreError('You do not own this store.');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // All checks passed
      setIsAuthorized(true);
      setStore(storeData);
      loadQueues(storeData.id);
      loadPendingRequests(storeData.id, { notifyNew: false });
      subscribeToChanges(storeData.id);
      setLoading(false);
    } catch (err) {
      console.error('Authorization check failed:', err);
      setStoreError('An error occurred. Please try again.');
      setIsAuthorized(false);
      setLoading(false);
    }
  };

  const loadStoreData = async () => {
    // Removed - now handled by checkAuthorization
  };

  useEffect(() => {
    // Check auth on mount
    checkAuthorization();

    // Get user location
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log('Location access denied')
    );
  }, [slug]);

  const loadQueues = async (storeId: number) => {
    const { data } = await supabase
      .from('draft_queues')
      .select('*')
      .eq('store_id', storeId)
      .order('queue_number');
    
    const allQueues = data || [];
    const drafts = allQueues.filter((q: DraftQueue) => !q.label || !q.label.toLowerCase().includes('commander'));
    const commanders = allQueues.filter((q: CommanderQueue) => q.label && q.label.toLowerCase().includes('commander'));
    
    setDraftQueues(drafts as DraftQueue[]);
    setCommanderQueues(commanders as CommanderQueue[]);
  };

  const loadPendingRequests = async (storeId: number, options: { notifyNew?: boolean } = {}) => {
    const { data } = await supabase
      .from('draft_requests')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'pending');

    const requests = (data || []) as DraftRequest[];
    const nextIds = new Set(requests.map((request) => request.id));
    const hasNewRequest = requests.some((request) => !pendingRequestIdsRef.current.has(request.id));

    setPendingRequests(requests);

    if (options.notifyNew && hasNewRequest) {
      setRequestNotice('Player requested a queue');
      setTimeout(() => setRequestNotice(''), 8000);
    }

    pendingRequestIdsRef.current = nextIds;
    return requests;
  };

  const subscribeToChanges = (storeId: number) => {
    supabase.channel(`store-data-${storeId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'draft_queues', filter: `store_id=eq.${storeId}` }, 
        () => loadQueues(storeId)
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'draft_requests', filter: `store_id=eq.${storeId}` }, 
        (payload) => {
          const requestPayload = payload as RealtimeDraftRequestPayload;
          loadPendingRequests(storeId, { notifyNew: true });

          if (requestPayload.eventType === 'INSERT' && requestPayload.new?.status === 'pending') {
            setRequestNotice('Player requested a queue');
            setTimeout(() => setRequestNotice(''), 8000);
          }
        }
      )
      .subscribe();
  };

  useEffect(() => {
    return () => {
      // Cleanup QR scanner on unmount
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
      }
    };
  }, []);

  const busyPercent = store 
    ? Math.round(((store.current_players || 0) / (store.max_capacity || 40)) * 100) 
    : 0;

  const approveRequest = (req: DraftRequest) => {
    setApprovingRequest(req);
    setSelectedType(req.label || '');
    setSelectedPrice('');
  };

  const confirmApproval = async () => {
    if (!store || !approvingRequest || !selectedType || !selectedPrice) return;

    const storeId = store.id;

    const priceText = selectedPrice === 'TBD' ? 'TBD' : `$${selectedPrice}`;
    const finalLabel = `${selectedType} - ${priceText} (Player Requested)`;

    const { data: existing } = await supabase
      .from('draft_queues')
      .select('queue_number')
      .eq('store_id', storeId)
      .order('queue_number', { ascending: false })
      .limit(1);

    const nextNumber = (existing?.[0]?.queue_number || 0) + 1;

    const { data: newQueue } = await supabase.from('draft_queues').insert({
      type: 'draft',
      store_id: storeId,
      current_count: 1,
      status: 'open',
      players: [],
      queue_number: nextNumber,
      label: finalLabel
    }).select().single();

    const approvalNotes = [
      approvingRequest.notes?.trim(),
      newQueue?.id ? `approved_queue_id:${newQueue.id}` : null,
    ].filter(Boolean).join('\n');

    await supabase
      .from('draft_requests')
      .update({ status: 'approved', notes: approvalNotes || null })
      .eq('id', approvingRequest.id);

    alert(`✅ Queue #${nextNumber} created!\n${finalLabel}`);

    loadQueues(storeId);
    loadPendingRequests(storeId);

    if (newQueue && typeof window !== 'undefined') {
      const event = new CustomEvent('queueApproved', { detail: newQueue.id });
      window.dispatchEvent(event);
    }

    if (typeof window !== 'undefined') {
      window.refreshOtherQueues?.();
      window.refreshMyQueues?.();
    }

    setApprovingRequest(null);
    setSelectedType('');
    setSelectedPrice('');
  };

  const denyRequest = (request: DraftRequest) => {
    setDenyingRequest(request);
  };

  const confirmDenial = async (selectedReason: string) => {
    if (!store || !denyingRequest) return;

    const denialNotes = [
      denyingRequest.notes?.trim(),
      `denied_reason:${selectedReason}`,
    ].filter(Boolean).join('\n');

    await supabase
      .from('draft_requests')
      .update({ status: 'denied', notes: denialNotes || null })
      .eq('id', denyingRequest.id);

    setDenyingRequest(null);
    loadPendingRequests(store.id);
  };

  const markFiring = (queueId: number) => {
    setPendingQueueId(queueId);
    setShowJoinCodeModal(true);
    setSelectedEntryMethod(null);
    setManualJoinCode('');
  };

  const buildCompanionDeepLink = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    if (isUrl) {
      try {
        const parsedUrl = new URL(trimmed);
        const label = parsedUrl.searchParams.get('name') || parsedUrl.searchParams.get('title') || parsedUrl.hostname || 'Magic Event';
        const deepLink = `mtgcompanion://join?url=${encodeURIComponent(trimmed)}`;
        return {
          deepLink,
          fallback: trimmed,
          label,
        };
      } catch {
        return null;
      }
    }

    const code = trimmed.replace(/\s+/g, '');
    if (!code) return null;
    const deepLink = `mtgcompanion://join?code=${encodeURIComponent(code)}`;
    return {
      deepLink,
      fallback: `https://mtgcompanionlink.example/join?code=${encodeURIComponent(code)}`,
      label: `Event ${code}`,
    };
  };

  const finalizeQueueFiring = async (joinData: { deepLink: string; fallback: string; label: string }) => {
    if (!store || pendingQueueId === null) return;

    const queueId = pendingQueueId;
    const label = prompt('Enter label/time for the event (e.g. Table 1 at 3pm):', '');
    const internalCode = generateCompanionCode();

    await supabase
      .from('draft_queues')
      .update({
        status: 'firing',
        firing_code: internalCode,
        label: label?.trim() || null,
      })
      .eq('id', queueId);

    loadQueues(store.id);

    const newLink = {
        id: `${queueId}-${encodeURIComponent(joinData.deepLink)}`,
        label: joinData.label,
        deepLink: joinData.deepLink,
        fallback: joinData.fallback,
      };
    setJoinNowLinks((prev) => [newLink, ...prev]);
    setShowJoinCodeModal(false);
    setSelectedEntryMethod(null);
    setManualJoinCode('');
    setPendingQueueId(null);
  };

  const handleManualJoinCode = async () => {
    if (!manualJoinCode.trim()) {
      alert('Please enter the 6-digit join code.');
      return;
    }

    const joinData = buildCompanionDeepLink(manualJoinCode);
    if (!joinData) {
      alert('Invalid join code format. Please enter a valid code or URL.');
      return;
    }

    finalizeQueueFiring(joinData);
  };

  const markCanceled = async (queueId: number) => {
    if (!store) return;
    if (!confirm("Mark as Canceled?")) return;
    await supabase.from('draft_queues').update({ status: 'canceled' }).eq('id', queueId);
    loadQueues(store.id);
  };

  const markCompleted = async (queueId: number) => {
    if (!store) return;
    if (!confirm("Mark as Completed?")) return;
    await supabase.from('draft_queues').update({ status: 'completed' }).eq('id', queueId);
    loadQueues(store.id);
  };

  const clearAllQueues = async () => {
    if (!store) return;
    if (!confirm("WARNING: Permanently delete ALL queues?")) return;
    await supabase.from('draft_queues').delete().eq('store_id', store.id);
    loadQueues(store.id);
  };

  const startQrScan = async () => {
    if (!videoRef.current) return;

    setQrScannerModal(true);
    setScanning(true);

    try {
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        async (result) => {
          console.log('QR code scanned:', result.data);
          await handleQrScan(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      await qrScannerRef.current.start();
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      alert('Failed to access camera. Please ensure camera permissions are granted.');
      setQrScannerModal(false);
      setScanning(false);
    }
  };

  const stopQrScan = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setQrScannerModal(false);
    setScanning(false);
  };

  const handleQrScan = async (scannedData: string) => {
    try {
      console.log('QR code scanned:', scannedData);

      let eventUrl = '';

      // Try to parse as URL
      try {
        new URL(scannedData);
        eventUrl = scannedData;
      } catch {
        // If not a valid URL, check if it's a relative path or just text
        if (scannedData.startsWith('http://') || scannedData.startsWith('https://')) {
          eventUrl = scannedData;
        } else {
          alert('Invalid QR code. Expected a valid HTTP/HTTPS URL.');
          return;
        }
      }

      const joinData = buildCompanionDeepLink(eventUrl);
      if (!joinData) {
        alert('Could not parse the scanned event link into a Companion join link.');
        stopQrScan();
        return;
      }

      if (pendingQueueId === null) {
        alert('Start this scan from a queue by choosing Mark as Firing first.');
        stopQrScan();
        return;
      }

      await finalizeQueueFiring(joinData);
      alert(`✅ Companion join link created for ${joinData.label}. Players can tap the Join Now button.`);
      stopQrScan();

    } catch (error) {
      console.error('Error processing QR scan:', error);
      alert('Error processing QR code. Please try again.');
    }
  };

  // ==================== AUTH CHECK ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="bg-zinc-900 p-10 rounded-3xl max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-8">Store Dashboard</h1>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="bg-zinc-900 p-10 rounded-3xl max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-8">Store Dashboard</h1>
          <p className="text-red-300 mb-6">{storeError || 'Access denied'}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-bold text-lg"
          >
            ← Back to Player App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
     <div className="flex justify-between items-center mb-8">
  <div>
    <h1 className="text-4xl font-bold">{store?.name || 'Store Dashboard'}</h1>
    <p className="text-zinc-400 mt-1">Dashboard</p>
  </div>
        <button
          onClick={() => window.location.href = '/'}
          className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-xl font-medium"
        >
          ← Back to Player App
        </button>
      </div>

      {userLocation && store?.lat && store?.lng && (
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

      <button
        onClick={startQrScan}
        className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-xl mb-6 font-bold ml-4"
      >
        📱 Scan Event QR Code
      </button>

      {requestNotice && (
        <div className="mb-8 p-5 bg-orange-900/80 border border-orange-400 rounded-2xl text-orange-100 text-center text-lg font-bold">
          {requestNotice}
        </div>
      )}

      {joinNowLinks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6">Join Now Links</h2>
          <div className="space-y-4">
            {joinNowLinks.map((link) => (
              <div key={link.id} className="bg-zinc-800 p-6 rounded-3xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm text-zinc-400">{link.label}</div>
                    <div className="text-sm text-zinc-400 break-all">{link.fallback}</div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => window.open(link.deepLink, '_blank')}
                      className="bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-xl font-bold"
                    >
                      Open Companion
                    </button>
                    <button
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(link.deepLink);
                          alert('Deep link copied to clipboard!');
                        }
                      }}
                      className="bg-zinc-700 hover:bg-zinc-600 px-6 py-3 rounded-xl font-bold"
                    >
                      Copy Join Now Link
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showJoinCodeModal && (
        <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full">
            <h2 className="text-3xl font-bold mb-4 text-center">How do you want to enter the Join Code?</h2>
            <p className="text-zinc-400 mb-6 text-center">
              Choose manual entry or scan the Magic Event Link QR code. This will create a Companion App Join Now link.
            </p>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <button
                onClick={() => setSelectedEntryMethod('manual')}
                className={`p-5 rounded-3xl text-left border ${selectedEntryMethod === 'manual' ? 'border-emerald-500 bg-zinc-800' : 'border-zinc-700 bg-zinc-950 hover:bg-zinc-900'}`}
              >
                <div className="text-lg font-bold">Manual Entry</div>
                <div className="text-zinc-400 mt-2 text-sm">Type the 6-digit join code and generate the Companion App deep link.</div>
              </button>
              <button
                onClick={() => {
                  setSelectedEntryMethod('scan');
                  setShowJoinCodeModal(false);
                  startQrScan();
                }}
                className={`p-5 rounded-3xl text-left border ${selectedEntryMethod === 'scan' ? 'border-emerald-500 bg-zinc-800' : 'border-zinc-700 bg-zinc-950 hover:bg-zinc-900'}`}
              >
                <div className="text-lg font-bold">Scan QR Code</div>
                <div className="text-zinc-400 mt-2 text-sm">Open the camera and scan the Magic Event Link QR code to create the join link.</div>
              </button>
            </div>

            {selectedEntryMethod === 'manual' && (
              <div className="space-y-4 mb-4">
                <input
                  type="text"
                  value={manualJoinCode}
                  onChange={(e) => setManualJoinCode(e.target.value)}
                  placeholder="Enter 6-digit join code or event URL"
                  className="w-full p-4 bg-zinc-800 rounded-3xl border border-zinc-700"
                />
                <button
                  onClick={handleManualJoinCode}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-3xl font-bold"
                >
                  Generate Join Now Link
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowJoinCodeModal(false);
                setSelectedEntryMethod(null);
                setManualJoinCode('');
                setPendingQueueId(null);
              }}
              className="w-full bg-zinc-700 hover:bg-zinc-600 py-4 rounded-3xl font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending Player Requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-orange-400">📬 Pending Player Requests</h2>
          {pendingRequests.map((req) => (
            <div key={req.id} className="bg-zinc-800 p-6 rounded-3xl mb-6 border border-orange-500/30">
              <p className="text-lg font-medium">{req.label || 'Draft Request'}</p>
              {req.notes && <p className="text-sm text-zinc-400 mt-2">{req.notes}</p>}
              <div className="flex gap-3 mt-5">
                <button 
                  onClick={() => approveRequest(req)}
                  className="flex-1 bg-green-600 py-3 rounded-xl font-bold"
                >
                  Approve & Set Details
                </button>
                <button 
                  onClick={() => denyRequest(req)}
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
            <p className="text-zinc-400 mb-6">Original: {approvingRequest.label || 'No label provided'}</p>

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

      {/* Denial Reason Modal */}
      {denyingRequest && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-3xl font-bold mb-4">Deny Player Request</h2>
            <p className="text-zinc-400 mb-6">Choose a reason to show the player.</p>
            <div className="space-y-3">
              {denialReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => confirmDenial(reason)}
                  className="w-full p-4 bg-red-700 hover:bg-red-600 rounded-2xl text-left font-bold"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDenyingRequest(null)}
              className="mt-5 w-full py-4 bg-zinc-700 rounded-2xl font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <h2 className="text-3xl font-bold mb-6">Live Draft Queues</h2>
      {draftQueues.length === 0 ? (
        <p className="text-zinc-400 mb-6">No draft queues yet</p>
      ) : (
        draftQueues.map((q) => (
          <div key={q.id} className="bg-zinc-800 p-6 rounded-3xl mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-4xl font-bold">{q.current_count}/8</div>
                <p className="text-sm opacity-70">
                  Queue #{q.queue_number} • <span className="capitalize">{q.status}</span>
                </p>
                {q.label && <p className="text-yellow-400 mt-1">{q.label}</p>}
              </div>

              <div className="flex flex-col gap-2">
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

      <h2 className="text-3xl font-bold mb-6 mt-10">Commander Pods</h2>
      {commanderQueues.length === 0 ? (
        <p className="text-zinc-400 mb-6">No commander pods yet</p>
      ) : (
        commanderQueues.map((q) => (
          <div key={q.id} className="bg-zinc-800 p-6 rounded-3xl mb-8 border border-emerald-500/30">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-4xl font-bold text-emerald-400">{q.current_count}/4</div>
                <p className="text-sm opacity-70">
                  Queue #{q.queue_number} • <span className="capitalize">{q.status}</span>
                </p>
                {q.label && <p className="text-yellow-400 mt-1">{q.label}</p>}
              </div>

              <div className="flex flex-col gap-2">
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

      {qrModal && (
        <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full text-center">
            <h2 className="text-3xl font-bold mb-4">QR Join Link Generated</h2>
            <p className="text-zinc-400 mb-6">Scan this QR code or copy the link to open the companion join flow.</p>

            <div className="mx-auto mb-6 w-52 h-52 bg-white p-4 rounded-3xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrModal.link)}`}
                alt="Join QR code"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="bg-zinc-950 p-4 rounded-3xl mb-6 text-left break-words">
              <p className="text-sm text-zinc-400 mb-2">Join link</p>
              <p className="text-sm text-emerald-300">{qrModal.link}</p>
            </div>

            <div className="flex gap-3 flex-col">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrModal.link);
                  alert('Join link copied to clipboard');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-2xl font-bold"
              >
                Copy Join Link
              </button>
              <button
                onClick={() => setQrModal(null)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {qrScannerModal && (
        <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full">
            <h2 className="text-3xl font-bold mb-6 text-center">Scan Event QR Code</h2>
            <p className="text-zinc-400 mb-6 text-center">
              Scan an event QR code to create a join button for players.
            </p>

            <div className="relative mb-6">
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-2xl object-cover"
                playsInline
                muted
              />
              {scanning && (
                <div className="absolute inset-0 border-2 border-emerald-400 rounded-2xl animate-pulse pointer-events-none" />
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={stopQrScan}
                className="flex-1 py-4 bg-zinc-700 hover:bg-zinc-600 rounded-2xl font-bold"
              >
                Cancel
              </button>
              {!scanning && (
                <button
                  onClick={startQrScan}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-bold"
                >
                  Start Scanning
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <CreateDraftQueue 
  storeId={store!.id} 
  onCreated={() => loadQueues(store!.id)} 
      />
    </div>
  );
}
