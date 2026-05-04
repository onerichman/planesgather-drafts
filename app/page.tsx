// app/page.tsx
'use client';
import QuickDraftFinder from '@/components/QuickDraftFinder';
import MyActiveQueues from '@/components/MyActiveQueues';
import OtherActiveQueues from '@/components/OtherActiveQueues';
import AvailabilityToggle from '@/components/AvailabilityToggle';
import CreateLiveDraftRequest from '@/components/CreateLiveDraftRequest';

export default function Home() {
  const handleJoinFromOther = (queueId: number) => {
    const event = new CustomEvent('joinQueue', { detail: queueId });
    window.dispatchEvent(event);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-32">
      <div className="p-8 border-b border-zinc-800">
        <h1 className="text-5xl font-bold mb-1">Planesgather Drafts</h1>
        <p className="text-xl text-zinc-400">Beta — Find a draft with your group</p>
      </div>

      <div className="px-8 mt-6">
        <button
          onClick={() => {
            const slug = prompt("Enter store slug (e.g. test-store):", "test-store");
            if (slug) window.location.href = `/store/${slug.trim()}`;
          }}
          className="w-full bg-amber-600 hover:bg-amber-700 py-5 rounded-2xl text-xl font-bold"
        >
          🛠️ Open Store Dashboard (Owner)
        </button>
      </div>

      <QuickDraftFinder />
      <MyActiveQueues />
      <CreateLiveDraftRequest />
      <OtherActiveQueues onJoin={handleJoinFromOther} />
      <AvailabilityToggle />

      <div className="text-center text-xs text-zinc-500 mt-16 px-8">
        Beta version
      </div>
    </main>
  );
}