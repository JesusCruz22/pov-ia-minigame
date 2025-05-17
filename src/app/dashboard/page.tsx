// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type LeaderboardEntry = {
  username: string;
  score: number;
};

type MatchEntry = {
  started_at: string;
  score_ai: number;
  prompts: {
    level: number;
    title: string;
  };
};

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        setError(null);
        setLoading(true);

        // 1. Obtener leaderboard global
        const resLeaderboard = await fetch('/api/leaderboard');
        if (!resLeaderboard.ok) throw new Error('Error cargando leaderboard');
        const { leaderboard } = await resLeaderboard.json();
        setLeaderboard(leaderboard);

        // 2. Obtener historial si está logueado
        if (user?.id) {
          const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select('started_at, score_ai, prompts(level, title)')
            .eq('user_id', user.id)
            .order('started_at', { ascending: false });

          if (matchesError) throw matchesError;

          const normMatches: MatchEntry[] = (matches ?? []).map((m: any) => ({
            started_at: m.started_at,
            score_ai: m.score_ai,
            prompts: {
              level: m.prompts.level,
              title: m.prompts.title,
            },
          }));

          setHistory(normMatches || []);
        }
      } catch (err: any) {
        setError(err.message || 'Error cargando dashboard');
      } finally {
        setLoading(false);
      }
    }

    if (isLoaded) {
      loadData();
    }
  }, [user, isLoaded]);

  if (loading) return <p className="p-4">Cargando dashboard…</p>;
  if (error) return <p className="p-4 text-red-600">Error: {error}</p>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">Leaderboard Global</h2>
        <ol className="list-decimal list-inside space-y-1">
          {leaderboard.length === 0 && <li>No hay datos aún.</li>}
          {leaderboard.map((entry, i) => (
            <li key={i}>
              <strong>{entry.username}</strong> — {entry.score}
            </li>
          ))}
        </ol>
      </section>

      {user && history.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Tu Historial de Partidas</h2>
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="border p-2">Fecha</th>
                <th className="border p-2">Nivel</th>
                <th className="border p-2 text-left">Desafío</th>
                <th className="border p-2">Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m, i) => (
                <tr key={i}>
                  <td className="border p-2 text-center">
                    {new Date(m.started_at).toLocaleDateString()}
                  </td>
                  <td className="border p-2 text-center">{m.prompts.level}</td>
                  <td className="border p-2">{m.prompts.title}</td>
                  <td className="border p-2 text-center">{m.score_ai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {user && history.length === 0 && (
        <p className="text-gray-600">Aún no has jugado ninguna partida.</p>
      )}

      <section className="flex gap-4">
        <button
          onClick={() => router.push('/play')}
          className="flex-1 bg-blue-600 text-white rounded p-2"
        >
          Empezar a Jugar
        </button>
      </section>
    </main>
  );
}
