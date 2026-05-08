// components/MyActiveQueues.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId, readNumberList, writeNumberList } from '@/utils/storage';

type ActiveQueue = {
  id: number;
  current_count: number;
  status: string;
  firing_code: string | null;
  label: string | null;
  stores: { name: string };
};


const getStatusClass = (status: string) => {
  if (status === 'firing') return 'text-orange-400';
  if (status === 'canceled') return 'text-red-400';
  if (status === 'completed') return 'text-sky-400';
  return 'text-green-400';
};

export default function MyActiveQueues() {
  const [queues, setQueues] = useState<ActiveQueue[]>([]);
  const [copiedQueueId, setCopiedQueueId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [participantStatuses, setParticipantStatuses] = useState<Record<number, { status: 'enroute' | 'at_store'; joined_at: string }>>({});
  const [allParticipants, setAllParticipants] = useState<Record<number, Array<{ status: 'enroute' | 'at_store'; joined_at: string; user_id: string }>>>({});

  console.log("🚀 MyActiveQueues component mounted/updated", { userId });

  // Load all participants for joined queues
  const loadAllParticipants = async () => {
    console.log('MyActiveQueues: Loading all participants for queues');

    const { data: participants, error } = await supabase
      .from('queue_participants')
      .select('queue_id, status, joined_at, user_id')
      .neq('status', 'withdrawn');

    if (error) {
      console.error('MyActiveQueues: Error loading participants:', error);
      return;
    }

    console.log('MyActiveQueues: Found all participants:', participants);

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
      console.log('MyActiveQueues: Final participants by queue:', participantsByQueue);
      setAllParticipants(participantsByQueue);
    } else {
      console.log('MyActiveQueues: No participants found');
    }
  };

  // Load participant status for joined queues (current user only)
  const loadParticipantStatuses = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('MyActiveQueues: No user ID for participant status loading');
      return;
    }

    console.log('MyActiveQueues: Loading participant status for user:', userId);

    const { data: participants, error } = await supabase
      .from('queue_participants')
      .select('queue_id, status, joined_at')
      .eq('user_id', userId)
      .neq('status', 'withdrawn');

    if (error) {
      console.error('MyActiveQueues: Error loading participant status:', error);
      return;
    }

    console.log('MyActiveQueues: Found participants:', participants);

    if (participants) {
      const statuses: Record<number, { status: 'enroute' | 'at_store'; joined_at: string }> = {};
      participants.forEach((p: any) => {
        console.log('MyActiveQueues: Setting status for queue', p.queue_id, ':', p.status);
        statuses[p.queue_id] = {
          status: p.status,
          joined_at: p.joined_at
        };
      });
      console.log('MyActiveQueues: Final statuses:', statuses);
      setParticipantStatuses(statuses);
    } else {
      console.log('MyActiveQueues: No participants found for user');
    }
  };

  const loadMyQueues = useCallback(async () => {
    if (!userId) {
      console.log("❌ No userId available, cannot load queues");
      return;
    }

    console.log("🔍 Loading queues for user:", userId);

    // Get queues where user is a participant (not withdrawn)
    const { data: userParticipants, error: participantError } = await supabase
      .from('queue_participants')
      .select('queue_id')
      .eq('user_id', userId)
      .neq('status', 'withdrawn');

    if (participantError) {
      console.error("❌ Error fetching user participants:", participantError);
      return;
    }

    const joinedQueueIds = userParticipants?.map(p => p.queue_id) || [];
    console.log("� User is participating in queues:", joinedQueueIds);

    if (joinedQueueIds.length === 0) {
      console.log("📊 No active queues found for user");
      setQueues([]);
      return;
    }

    // Get the actual queue details
    const { data: queues, error: queueError } = await supabase
      .from('draft_queues')
      .select(`
        *,
        stores!inner(name)
      `)
      .in('id', joinedQueueIds);

    if (queueError) {
      console.error("❌ Error fetching queues:", queueError);
      return;
    }

    const allQueues = (queues || []) as ActiveQueue[];
    console.log("📊 Queues found:", allQueues.length, allQueues.map(q => ({ id: q.id, status: q.status, label: q.label })));

    // Filter to only draft queues (exclude commander pods)
    const data = allQueues.filter(queue => {
      const isCommander = queue.label && queue.label.toLowerCase().includes('commander');
      console.log(`🔍 Queue ${queue.id}: ${queue.label}, isCommander: ${isCommander}`);
      return !isCommander;
    });
    console.log("🔄 After filtering commander queues:", data.length, data.map(q => ({ id: q.id, status: q.status })));

    console.log("🔄 Processing queues:", data.length);
    const uniqueQueues = new Map<number, ActiveQueue>();
    for (const queue of data) {
      console.log(`✅ Adding queue ${queue.id} to display`);
      uniqueQueues.set(queue.id, queue);
    }

    const finalQueues = Array.from(uniqueQueues.values());
    console.log("🎯 Final queues to display:", finalQueues.length, finalQueues.map(q => ({ id: q.id, status: q.status })));
    setQueues(finalQueues);
  }, [userId]);

  const withdrawFromQueue = async (queue: ActiveQueue) => {
    if (!confirm("Withdraw from this queue?")) return;

    writeNumberList('joinedQueueIds', readNumberList('joinedQueueIds', userId).filter((id) => id !== queue.id), userId);
    writeNumberList('withdrawnQueueIds', [...readNumberList('withdrawnQueueIds', userId), queue.id], userId);
    setQueues((current) => current.filter((q) => q.id !== queue.id));
    window.dispatchEvent(new CustomEvent('joinedQueuesChanged'));

    // Delete participant record from database
    console.log('MyActiveQueues: Attempting to delete participant for queue:', queue.id, 'user:', userId);
    
    const { data: deleteData, error: deleteError } = await supabase
      .from('queue_participants')
      .delete()
      .eq('queue_id', queue.id)
      .eq('user_id', userId)
      .select();

    console.log('MyActiveQueues: Delete result:', { deleteData, deleteError });

    if (deleteError) {
      console.error('Error deleting participant record:', deleteError);
    } else {
      console.log('MyActiveQueues: Successfully deleted participant record');
    }

    window.refreshOtherQueues?.();
    
    // Remove from withdrawn list so user can rejoin
    setTimeout(() => {
      writeNumberList('withdrawnQueueIds', readNumberList('withdrawnQueueIds', userId).filter((id) => id !== queue.id), userId);
    }, 1000); // Wait 1 second before removing from withdrawn list
  };

  const copyCompanionCode = async (queue: ActiveQueue) => {
    if (!queue.firing_code) return;

    await navigator.clipboard.writeText(queue.firing_code);
    setCopiedQueueId(queue.id);
    setTimeout(() => setCopiedQueueId(null), 1800);
  };

  useEffect(() => {
    const loadUser = async () => {
      const id = await getCurrentUserId();
      setUserId(id);
    };
    loadUser();
    loadMyQueues();
    loadAllParticipants();
    loadParticipantStatuses();
    const interval = setInterval(loadMyQueues, 2500);
    return () => clearInterval(interval);
  }, [loadMyQueues]);

  useEffect(() => {
    const handleJoinedQueuesChanged = () => {
      console.log("🎯 joinedQueuesChanged event received");
      loadMyQueues();
    };
    window.addEventListener('joinedQueuesChanged', handleJoinedQueuesChanged);

    const handleAuthOrProfileUpdate = () => {
      console.log("🔄 auth/profile update detected, reloading active queues");
      loadMyQueues();
    };
    window.addEventListener('focus', handleAuthOrProfileUpdate);
    window.addEventListener('profileUpdated', handleAuthOrProfileUpdate);
    window.addEventListener('authChanged', handleAuthOrProfileUpdate);

    // Listen for storage changes (in case localStorage is modified externally)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'joinedQueueIds' || e.key === 'withdrawnQueueIds') {
        console.log("💾 localStorage changed:", e.key, e.oldValue, "->", e.newValue);
        loadMyQueues();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Re-check every 2 seconds (helps with timing issues)
    const interval = setInterval(loadMyQueues, 2000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('joinedQueuesChanged', handleJoinedQueuesChanged);
      window.removeEventListener('focus', handleAuthOrProfileUpdate);
      window.removeEventListener('profileUpdated', handleAuthOrProfileUpdate);
      window.removeEventListener('authChanged', handleAuthOrProfileUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadMyQueues]);

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">Your Active Queues</h2>
      
      {queues.length === 0 ? (
        <p className="text-zinc-400">You haven&apos;t joined any queues yet.</p>
      ) : (
        queues.map((q) => (
          <div key={q.id} className="bg-zinc-900 p-6 rounded-3xl mb-6 border border-green-500/50">
            <h3 className="text-xl font-semibold">{q.stores.name}</h3>
            <div className="text-5xl font-bold text-green-400 my-2">{q.current_count}/8</div>
            <p>Status: <span className={`capitalize font-bold ${getStatusClass(q.status)}`}>{q.status}</span></p>
            {q.label && <p className="text-yellow-400">{q.label}</p>}
            
            {allParticipants[q.id] && allParticipants[q.id].length > 0 && (
              <div className="mb-3 p-3 bg-zinc-800 rounded-lg text-sm">
                <p className="text-zinc-400 mb-1">Players in this queue ({allParticipants[q.id].length}/8):</p>
                {allParticipants[q.id].map((participant, index) => (
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
            
            {participantStatuses[q.id] && (
              <div className="mb-3 p-3 bg-zinc-800 rounded-lg text-sm">
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
            {q.status === 'firing' && q.firing_code && (
              <div className="mt-4 p-4 bg-black rounded-xl border border-orange-400">
                <p className="text-sm text-orange-300 mb-1">Companion App Code</p>
                <button
                  onClick={() => copyCompanionCode(q)}
                  className="w-full text-3xl font-mono font-bold py-2 rounded-lg hover:bg-zinc-900 active:scale-[0.98] transition"
                >
                  {q.firing_code}
                </button>
                <p className="text-xs text-zinc-400 mt-1 mb-4">
                  {copiedQueueId === q.id ? 'Copied' : 'Tap code to copy'}
                </p>

                <button
                  onClick={() => {
                    const joinLink = `${window.location.origin}/join?code=${encodeURIComponent(q.firing_code || '')}`;
                    window.location.href = joinLink;
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl text-base font-bold transition"
                >
                  Press here to join the queue in your companion app
                </button>
              </div>
            )}
            {q.status === 'canceled' && (
              <div className="mt-4 p-4 bg-red-950 border border-red-500 rounded-xl text-red-100 text-center font-medium">
                This queue was canceled by the store.
              </div>
            )}
            {q.status === 'completed' && (
              <div className="mt-4 p-4 bg-sky-950 border border-sky-500 rounded-xl text-sky-100 text-center font-medium">
                Check your app for standings and staff for prizing.
              </div>
            )}
            {(q.status === 'open' || q.status === 'firing') && (
              <button
                onClick={() => withdrawFromQueue(q)}
                className="mt-5 w-full bg-zinc-800 hover:bg-red-700 border border-zinc-700 hover:border-red-500 py-3 rounded-xl text-sm font-bold transition"
              >
                Withdraw
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
