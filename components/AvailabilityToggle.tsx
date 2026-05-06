'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type GameType = 'any' | 'commander' | 'draft' | 'standard' | null;

export default function AvailabilityToggle() {
  const [status, setStatus] = useState<'off' | 'looking_now'>('off');
  const [gameType, setGameType] = useState<GameType>(null);
  const [showGameTypeModal, setShowGameTypeModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const gameTypeLabels: Record<Exclude<GameType, null>, string> = {
    any: 'Any Game Type',
    commander: 'Commander',
    draft: 'Draft',
    standard: 'Standard'
  };

  // Load saved preferences from localStorage
  useEffect(() => {
    const savedStatus = localStorage.getItem('availabilityStatus');
    const savedGameType = localStorage.getItem('availabilityGameType');
    
    if (savedStatus === 'looking_now') {
      setStatus('looking_now');
    }
    if (savedGameType) {
      setGameType(savedGameType as GameType);
    }
  }, []);

  const handleToggle = async () => {
    if (status === 'off') {
      // Turning ON - show game type selector
      setShowGameTypeModal(true);
    } else {
      // Turning OFF
      setLoading(true);
      await supabase.from('profiles').update({ 
        availability_status: 'off',
        availability_updated_at: new Date().toISOString(),
        game_type_preference: null
      });
      setStatus('off');
      setGameType(null);
      localStorage.removeItem('availabilityStatus');
      localStorage.removeItem('availabilityGameType');
      setLoading(false);
    }
  };

  const selectGameType = async (selected: Exclude<GameType, null>) => {
    setLoading(true);
    setGameType(selected);
    localStorage.setItem('availabilityGameType', selected);
    localStorage.setItem('availabilityStatus', 'looking_now');

    await supabase.from('profiles').update({
      availability_status: 'looking_now',
      availability_updated_at: new Date().toISOString(),
      game_type_preference: selected
    });

    setStatus('looking_now');
    setShowGameTypeModal(false);
    setLoading(false);
  };

  return (
    <>
      <div className="flex items-center justify-center gap-3 bg-zinc-900/80 border border-green-500/30 rounded-2xl px-6 py-3 backdrop-blur-sm max-w-fit mx-auto">
        <span className="font-medium text-sm">{status === 'off' ? 'Open for games' : `Looking: ${gameTypeLabels[gameType!]}`}</span>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`px-5 py-2 rounded-full font-bold transition text-sm ${
            status === 'off' 
              ? 'bg-zinc-700 hover:bg-zinc-600' 
              : 'bg-green-600 hover:bg-green-700'
          } disabled:opacity-50`}
        >
          {loading ? '...' : (status === 'off' ? 'OFF' : 'ON')}
        </button>
      </div>

      {showGameTypeModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-8 max-w-md w-full text-center">
            <h2 className="text-3xl font-bold mb-8">What type of game are you looking for?</h2>
            
            <div className="space-y-3">
              {(['any', 'commander', 'draft', 'standard'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => selectGameType(type)}
                  disabled={loading}
                  className="w-full p-4 bg-zinc-800 hover:bg-green-600 transition rounded-2xl font-bold text-lg disabled:opacity-50"
                >
                  {gameTypeLabels[type]}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowGameTypeModal(false)}
              className="mt-6 w-full py-3 bg-zinc-700 hover:bg-zinc-600 rounded-2xl font-bold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
