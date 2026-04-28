// components/VoteAndPay.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  queueId: number;
  onVoted: () => void;
}

export default function VoteAndPay({ queueId, onVoted }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<any>(null);

  useEffect(() => {
    loadQueueAndProducts();
  }, [queueId]);

  const loadQueueAndProducts = async () => {
    // Load queue info
    const { data: q } = await supabase
      .from('draft_queues')
      .select('*, stores!inner(id)')
      .eq('id', queueId)
      .single();

    setQueue(q);

    if (q?.stores?.id) {
      const { data: p } = await supabase
        .from('draft_products')
        .select('*')
        .eq('store_id', q.stores.id);
      setProducts(p || []);
    }

    // Check if user already voted
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('queue_votes')
        .select('*')
        .eq('queue_id', queueId)
        .eq('user_id', user.id)
        .single();
      setHasVoted(!!data);
    }
  };

  const castVote = async (productId: number) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please sign in");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('queue_votes')
      .insert({
        queue_id: queueId,
        user_id: user.id,
        product_id: productId
      });

    if (error) {
      alert("Vote failed: " + error.message);
    } else {
      setSelected(productId);
      setHasVoted(true);
      alert("Your vote has been recorded!");
      onVoted();
    }
    setLoading(false);
  };

  if (products.length === 0) {
    return <div className="text-zinc-400 mt-4">No draft products available yet.</div>;
  }

  return (
    <div className="bg-purple-950 p-8 rounded-3xl mt-6">
      <h3 className="text-2xl font-bold mb-6">Queue is Full! What should we draft?</h3>

      <div className="space-y-4">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => castVote(p.id)}
            disabled={hasVoted || loading}
            className={`w-full p-6 rounded-2xl text-left transition-all ${
              selected === p.id 
                ? 'bg-white text-black ring-2 ring-green-400' 
                : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <div className="flex justify-between text-lg">
              <span>{p.name}</span>
              <span className="font-bold">${(p.price / 100).toFixed(0)}</span>
            </div>
            {p.is_special && <span className="text-yellow-400 text-sm block mt-1">★ Special Deal</span>}
          </button>
        ))}
      </div>

      {hasVoted && (
        <div className="mt-8 text-center text-green-400 font-medium">
          ✅ Thank you for voting!
        </div>
      )}
    </div>
  );
}