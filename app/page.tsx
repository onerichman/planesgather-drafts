// app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import QuickDraftFinder from '@/components/QuickDraftFinder';
import MyActiveQueues from '@/components/MyActiveQueues';
import OtherActiveQueues from '@/components/OtherActiveQueues';
import AvailabilityToggle from '@/components/AvailabilityToggle';
import CreateLiveDraftRequest from '@/components/CreateLiveDraftRequest';
import CommanderQueues from '@/components/CommanderQueues';
import PlayerSignUp from '@/components/PlayerSignUp';
import StoreSignUp from '@/components/StoreSignUp';
import Login from '@/components/Login';

export default function Home() {
  const [gameType, setGameType] = useState<'draft' | 'commander' | null>(null);
  const [authModal, setAuthModal] = useState<{
    type: 'player-signup' | 'store-signup' | 'player-login' | 'store-login' | null;
  }>({ type: null });
  const [user, setUser] = useState<User | null>(null);
  const [storeLoginPending, setStoreLoginPending] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration and localStorage
  useEffect(() => {
    setIsHydrated(true);
    const navigationEntries = window.performance?.getEntriesByType?.('navigation') || [];
    const navigationEntry = navigationEntries[0];
    const navigationType = navigationEntry && 'type' in navigationEntry ? (navigationEntry as PerformanceNavigationTiming).type : 'navigate';

    if (navigationType === 'reload') {
      const savedGameType = localStorage.getItem('selectedGameType');
      if (savedGameType === 'draft' || savedGameType === 'commander') {
        setGameType(savedGameType);
      }
    }
  }, []);

  useEffect(() => {
    if (gameType) {
      localStorage.setItem('selectedGameType', gameType);
    } else {
      localStorage.removeItem('selectedGameType');
    }
  }, [gameType]);

  // Check auth state
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      window.dispatchEvent(new Event('authChanged'));
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      window.dispatchEvent(new Event('authChanged'));
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Supabase sign out failed:', err);
    } finally {
      setUser(null);
      setGameType(null);
      setAuthModal({ type: null });
      setStoreLoginPending(false);
      localStorage.removeItem('selectedGameType');
      window.dispatchEvent(new Event('authChanged'));
      window.location.href = '/';
    }
  };

  const handleJoinFromOther = (queueId: number) => {
    const event = new CustomEvent('joinQueue', { detail: queueId });
    window.dispatchEvent(event);
  };

  const handleStoreClick = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      setStoreLoginPending(true);
      setAuthModal({ type: 'store-login' });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', currentUser.id)
      .single();

    if (profileError || !profile || profile.user_type !== 'store') {
      alert('Please sign in with a store account to access the dashboard.');
      setStoreLoginPending(true);
      setAuthModal({ type: 'store-login' });
      return;
    }

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('slug')
      .eq('owner_id', currentUser.id)
      .limit(1)
      .maybeSingle();

    if (storeError || !storeData?.slug) {
      alert('Could not find a store for this account. Please contact support or sign up first.');
      return;
    }

    window.location.href = `/store/${storeData.slug}`;
  };

  const handlePlayerSignUp = () => {
    setAuthModal({ type: 'player-signup' });
  };

  const closeAuthModal = () => {
    setAuthModal({ type: null });
  };

  const handleAuthComplete = () => {
    setAuthModal({ type: null });
    if (storeLoginPending) {
      setStoreLoginPending(false);
      handleStoreClick();
    }
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
        {!isHydrated ? (
          // Loading state during hydration
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-xl">Loading...</div>
          </div>
        ) : !gameType ? (
          <div className="min-h-screen flex items-end justify-center p-8 relative">
            {/* Store Dashboard Link - Top Right Corner */}
            <div className="absolute top-8 right-8">
              <button
                onClick={handleStoreClick}
                className="bg-zinc-800/80 hover:bg-zinc-700/80 border border-amber-500/30 text-amber-400 hover:text-amber-300 px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm transition-all duration-200 shadow-lg"
                title={user ? "Go to Store Dashboard" : "Store Login/Signup"}
              >
                🏪 {user ? 'Dashboard' : 'Store'}
              </button>
            </div>

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

              {/* Player Authentication */}
              {!user ? (
                <div className="mt-8 text-center">
                  <button
                    onClick={handlePlayerSignUp}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-2xl text-lg font-bold shadow-2xl transition"
                  >
                    Sign Up as Player
                  </button>
                  <p className="text-sm text-zinc-400 mt-3">
                    Already have an account?{' '}
                    <button
                      onClick={() => setAuthModal({ type: 'player-login' })}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              ) : (
                <div className="mt-8 text-center">
                  <p className="text-sm text-zinc-400 mb-3">
                    Signed in as {user.email}
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-2xl text-lg font-bold shadow-2xl transition"
                  >
                    Sign Out
                  </button>
                </div>
              )}
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
                <QuickDraftFinder />
                <MyActiveQueues />
                <CreateLiveDraftRequest />
                <OtherActiveQueues onJoin={handleJoinFromOther} />
              </>
            ) : (
              <CommanderQueues />
            )}

            {/* Static Availability Toggle */}
            <div className="px-8 mt-8 mb-8">
              <AvailabilityToggle />
            </div>

            <div className="text-center text-xs text-zinc-400 mt-16 px-8">
              Beta version
            </div>
          </>
        )}

        {/* Authentication Modals */}
        {authModal.type === 'player-signup' && (
          <PlayerSignUp
            onComplete={handleAuthComplete}
            onCancel={closeAuthModal}
          />
        )}

        {authModal.type === 'store-signup' && (
          <StoreSignUp
            onComplete={handleAuthComplete}
            onCancel={closeAuthModal}
          />
        )}

        {authModal.type === 'player-login' && (
          <Login
            userType="player"
            onComplete={handleAuthComplete}
            onCancel={closeAuthModal}
            onSwitchToSignUp={() => setAuthModal({ type: 'player-signup' })}
          />
        )}

        {authModal.type === 'store-login' && (
          <Login
            userType="store"
            onComplete={handleAuthComplete}
            onCancel={closeAuthModal}
            onSwitchToSignUp={() => setAuthModal({ type: 'store-signup' })}
          />
        )}
      </div>
    </main>
  );
}
