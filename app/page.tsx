// app/page.tsx
import QuickDraftFinder from '@/components/QuickDraftFinder';
import AvailabilityToggle from '@/components/AvailabilityToggle';
import MyQueues from '@/components/MyQueues';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-32">
      <div className="p-8">
        <h1 className="text-5xl font-bold mb-1">Planesgather Drafts</h1>
        <p className="text-zinc-400 text-xl">Beta — Find a draft or pod near you</p>
      </div>

      <QuickDraftFinder />
      <MyQueues />
      <AvailabilityToggle />

      <div className="fixed bottom-4 left-0 right-0 text-center text-xs text-zinc-500">
        Draft-only Beta
      </div>
    </main>
  );
}