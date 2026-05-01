// app/auth/page.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) alert("Login failed: " + error.message);
      else alert("Signed in successfully! Go back to homepage.");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) alert("Sign up failed: " + error.message);
      else alert("Sign up successful! You can now sign in.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="bg-zinc-900 p-10 rounded-3xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-8">Planesgather Drafts</h1>
        <p className="text-center text-zinc-400 mb-8">Beta</p>

        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-4 bg-zinc-800 rounded-xl mb-4"
        />

        <input
          type="password"
          placeholder="Password (at least 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-4 bg-zinc-800 rounded-xl mb-8"
        />

        <button
          onClick={handleAuth}
          disabled={loading}
          className="w-full bg-green-600 py-5 rounded-2xl font-bold text-lg disabled:opacity-50"
        >
          {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
        </button>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="mt-4 text-zinc-400 w-full text-sm"
        >
          {isLogin ? "Need an account? Sign Up" : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  );
}