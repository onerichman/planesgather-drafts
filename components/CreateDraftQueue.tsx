// components/CreateDraftQueue.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  storeId: number;
  onCreated: () => void;
}

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

const priceOptions = [20, 25, 30, 35, 40];

export default function CreateDraftQueue({ storeId, onCreated }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<'type' | 'price'>('type');
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [customPrice, setCustomPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const resetModal = () => {
    setStep('type');
    setSelectedType('');
    setSelectedPrice(null);
    setCustomPrice('');
  };

  const openModal = () => {
    resetModal();
    setShowModal(true);
  };

  const createQueue = async () => {
    const price = selectedPrice || parseInt(customPrice);
    if (!selectedType || !price) return;

    const finalLabel = `${selectedType} - $${price}`;

    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from('draft_queues')
        .select('queue_number')
        .eq('store_id', storeId)
        .order('queue_number', { ascending: false })
        .limit(1);

      const nextNumber = (existing?.[0]?.queue_number || 0) + 1;

      const { error } = await supabase.from('draft_queues').insert({
        type: 'draft',
        store_id: storeId,
        current_count: 0,
        status: 'open',
        players: [],
        queue_number: nextNumber,
        label: finalLabel
      });

      if (error) throw error;

      alert(`✅ Queue #${nextNumber} created!\n${finalLabel}`);
      setShowModal(false);
      resetModal();
      onCreated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert('Error: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        className="bg-yellow-600 hover:bg-yellow-700 w-full py-6 rounded-2xl text-xl font-bold mt-8"
      >
        + Create New Draft Queue
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full">
            {step === 'type' ? (
              <>
                <h2 className="text-3xl font-bold mb-6 text-center">Choose Draft Type</h2>
                <div className="space-y-3 mb-8 max-h-[65vh] overflow-y-auto pr-2">
                  {draftTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setSelectedType(type);
                        setStep('price');
                      }}
                      className="w-full p-5 rounded-2xl text-left bg-zinc-800 hover:bg-zinc-700 transition text-lg"
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full py-4 bg-zinc-700 rounded-2xl font-bold"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold mb-2 text-center">Set Draft Price</h2>
                <p className="text-center text-zinc-400 mb-6">{selectedType}</p>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {priceOptions.map((price) => (
                    <button
                      key={price}
                      onClick={() => setSelectedPrice(price)}
                      className={`p-6 rounded-2xl text-2xl font-bold transition ${
                        selectedPrice === price 
                          ? 'bg-green-600 text-white' 
                          : 'bg-zinc-800 hover:bg-zinc-700'
                      }`}
                    >
                      ${price}
                    </button>
                  ))}
                </div>

                <div className="mb-8">
                  <p className="text-sm text-zinc-400 mb-2 text-center">Or enter custom price</p>
                  <input
                    type="number"
                    placeholder="28"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full p-5 bg-zinc-800 rounded-2xl text-center text-2xl"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('type')}
                    className="flex-1 py-4 bg-zinc-700 rounded-2xl font-bold"
                  >
                    Back
                  </button>
                  <button
                    onClick={createQueue}
                    disabled={loading || (!selectedPrice && !customPrice)}
                    className="flex-1 py-4 bg-yellow-600 rounded-2xl font-bold disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Queue'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
