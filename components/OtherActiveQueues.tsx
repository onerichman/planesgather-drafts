// components/OtherActiveQueues.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId, readNumberList } from '@/utils/storage';
import { getDistance } from '@/utils/distance';

interface Props {
  onJoin: (queueId: number) => void;
}

type ActiveQueue = {
  id: number;
  current_count: number;
  status: string;
  label: string | null;
  queue_number: number;
  stores: { name: string; lat: number; lng: number };
};

export default function OtherActiveQueues({ onJoin }: Props): import("react/jsx-runtime").JSX.Element {
  const [queues, setQueues] = useState<ActiveQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [participantStatuses, setParticipantStatuses] = useState<Record<number, { status: 'enroute' | 'at_store'; joined_at: string }>>({});
  const [allParticipants, setAllParticipants] = useState<Record<number, Array<{ status: 'enroute' | 'at_store'; joined_at: string; user_id: string }>>>({});

  // Load all participants for queues
  const loadAllParticipants = async () => {
    console.log('OtherActiveQueues: Loading all participants for queues');

    const { data: participants, error } = await supabase
      .from('queue_participants')
      .select('queue_id, status, joined_at, user_id')
      .neq('status', 'withdrawn');

    if (error) {
      console.error('OtherActiveQueues: Error loading participants:', error);
      return;
    }

    console.log('OtherActiveQueues: Found all participants:', participants);

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
      console.log('OtherActiveQueues: Final participants by queue:', participantsByQueue);
      setAllParticipants(participantsByQueue);
    } else {
      console.log('OtherActiveQueues: No participants found');
    }
  };

  // Load participant status for joined queues (current user only)
  const loadParticipantStatuses = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('OtherActiveQueues: No user ID for participant status loading');
      return;
    }

    console.log('OtherActiveQueues: Loading participant status for user:', userId);

    const { data: participants, error } = await supabase
      .from('queue_participants')
      .select('queue_id, status, joined_at')
      .eq('user_id', userId)
      .neq('status', 'withdrawn');

    if (error) {
      console.error('OtherActiveQueues: Error loading participant status:', error);
      return;
    }

    console.log('OtherActiveQueues: Found participants:', participants);

    if (participants) {
      const statuses: Record<number, { status: 'enroute' | 'at_store'; joined_at: string }> = {};
      participants.forEach((p: any) => {
        console.log('OtherActiveQueues: Setting status for queue', p.queue_id, ':', p.status);
        statuses[p.queue_id] = {
          status: p.status,
          joined_at: p.joined_at
        };
      });
      console.log('OtherActiveQueues: Final statuses:', statuses);
      setParticipantStatuses(statuses);
    } else {
      console.log('OtherActiveQueues: No participants found for user');
    }
  };

  const loadQueues = useCallback(async (): Promise<void> => {
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
      .order('created_at', { ascending: false });

    setQueues((data || []) as unknown as ActiveQueue[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const id = await getCurrentUserId();
      setUserId(id);
    };
    loadUser();
    loadQueues();
    loadAllParticipants();
    loadParticipantStatuses();
    const interval = setInterval(loadQueues, 2500);

    return () => {
      // No channel to remove
    };
  }, [loadQueues]);

  // Read joined queues for current user
  let joinedQueueIds: number[] = [];
  if (typeof window !== 'undefined') {
    joinedQueueIds = readNumberList('joinedQueueIds', userId);
  }

  if (loading) {
    return <div className="px-8 mt-12 text-zinc-400">Loading active queues...</div>;
  }

  const filteredQueues = queues.filter((q) => {
    const isJoined = joinedQueueIds.includes(q.id);
    const isCommander = q.label && q.label.toLowerCase().includes('commander');
    if (isJoined || isCommander) return false;

    if (!location) return true;

    const distance = getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng);
    return distance <= 50;
  });

  return (
    <div className="px-8 mt-12">
      <h2 className="text-2xl font-bold mb-4">Other Active Queues Nearby</h2>
      
      {filteredQueues.length === 0 ? (
        <p className="text-zinc-400">No other active queues right now.</p>
      ) : (
        filteredQueues.map((q) => (
          <div 
            key={q.id} 
            onClick={() => onJoin(q.id)}
            className="bg-zinc-900 p-6 rounded-3xl mb-6 hover:border hover:border-green-500 cursor-pointer transition-all active:scale-[0.98]"
          >
            <h3 className="text-xl font-semibold">{q.stores.name}</h3>
            <div className="text-4xl font-bold my-2 text-green-400">{q.current_count}/8</div>
            
            <p className="capitalize">Status: <span className="font-medium">{q.status}</span></p>
            {q.label && <p className="text-yellow-400 mt-1">{q.label}</p>}
            <p className="text-sm text-zinc-500">Queue #{q.queue_number}</p>
            
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
            {location && (
              <p className="text-sm text-zinc-400 mt-2">
                {Math.round(getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng))} miles • {getDistance(location.lat, location.lng, q.stores.lat, q.stores.lng) <= 1 ? 'At store' : 'En route'}
              </p>
            )}

            <div className="mt-4 text-center text-green-400 font-bold text-sm border border-green-500/50 py-3 rounded-xl">
              Click here to Join Now
            </div>
          </div>
        ))
      )}
    </div>
  );
}
