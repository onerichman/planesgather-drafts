// app/page.tsx
'use client';
import { useState } from 'react';
import QuickDraftFinder from '@/components/QuickDraftFinder';
import MyActiveQueues from '@/components/MyActiveQueues';
import OtherActiveQueues from '@/components/OtherActiveQueues';
import AvailabilityToggle from '@/components/AvailabilityToggle';
import CreateLiveDraftRequest from '@/components/CreateLiveDraftRequest';
import CommanderQueues from '@/components/CommanderQueues';

export default function Home() {
  const [gameType, setGameType] = useState<'draft' | 'commander' | null>(null);

  const handleJoinFromOther = (queueId: number) => {
    const event = new CustomEvent('joinQueue', { detail: queueId });
    window.dispatchEvent(event);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-32 relative overflow-hidden">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-65"
        style={{
          backgroundImage: "url('/background.jpg')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />

      <div className="fixed inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/55" />

      <div className="relative z-10">
        {!gameType ? (
          <div className="min-h-screen flex items-end justify-center p-8">
            <div className="w-full max-w-lg pb-10">
              <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">Planesgather</h1>
              <p className="text-xl text-zinc-100 mb-8 drop-shadow">
                What type of game are you looking for?
              </p>
              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => setGameType('draft')}
                  className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl text-2xl font-bold shadow-2xl"
                >
                  Draft
                </button>
                <button
                  onClick={() => setGameType('commander')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 rounded-2xl text-2xl font-bold shadow-2xl"
                >
                  Commander
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-zinc-800 bg-black/25">
              <button
                onClick={() => setGameType(null)}
                className="mb-5 text-sm text-zinc-300 hover:text-white"
              >
                Back to game choice
              </button>
              <h1 className="text-5xl font-bold mb-1">
                {gameType === 'draft' ? 'Planesgather Drafts' : 'Planesgather Commander'}
              </h1>
              <p className="text-xl text-zinc-300">
                {gameType === 'draft'
                  ? 'Beta - Find a draft with your group'
                  : 'Create or join a 4-player Commander pod'}
              </p>
            </div>

            {gameType === 'draft' ? (
              <>
                <div className="px-8 mt-6">
                  <button
                    onClick={() => {
                      const slug = prompt('Enter store slug (e.g. test-store):', 'test-store');
                      if (slug) window.location.href = `/store/${slug.trim()}`;
                    }}
                    className="w-full bg-amber-600 hover:bg-amber-700 py-5 rounded-2xl text-xl font-bold"
                  >
                    Open Store Dashboard (Owner)
                  </button>
                </div>

                <QuickDraftFinder />
                <MyActiveQueues />
                <CreateLiveDraftRequest />
                <OtherActiveQueues onJoin={handleJoinFromOther} />
              </>
            ) : (
              <CommanderQueues />
            )}

            <AvailabilityToggle />

            <div className="text-center text-xs text-zinc-400 mt-16 px-8">
              Beta version
            </div>
          </>
        )}
      </div>
    </main>
  );
}
