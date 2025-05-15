'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { auth } from '@clerk/nextjs/server';

type RawEvaluation = {
    id: number;
    score: number;
    explanation: string;
    submitted_resources: { url: string }[];
};

type Evaluation = {
    id: number;
    score: number;
    explanation: string;
    url: string;
};

type LeaderboardEntry = {
    username: string;
    score: number;
};

export default function ResultPage() {
    const { matchId } = useParams();
    const router = useRouter();

    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [total, setTotal] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Guard para evitar dobles llamadas (por StrictMode o race conditions)
    const evalInProgress = useRef(false);
    useEffect(() => {
        if (!matchId) return;
        if (evalInProgress.current) return;
        evalInProgress.current = true;

        async function runEvaluationFlow() {
            setLoading(true);
            setError(null);

            try {
                console.log("matchId", matchId);
                // 1) Comprobar si ya hay evaluaciones para esta partida
                const { data: existing, error: exError } = await supabase
                    .from('ai_evaluations')
                    .select('score, explanation, submitted_resources(url)')
                    .eq('match_id', matchId);

                console.log("existing", existing);

                if (exError) throw exError;

                if (existing && existing.length === 0) {
                    // 2) Si no existen, lanzar la evaluación automática
                    const resEval = await fetch('/api/evaluate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ matchId }),
                    });
                    if (!resEval.ok) {
                        const payload = await resEval.json();
                        throw new Error(payload.error || 'Error en evaluación IA');
                    }
                    const { total: totalScore } = await resEval.json();
                    setTotal(totalScore);
                }

                // 3) Volver a obtener las evaluaciones completas
                const { data: rawEvals, error: evError } = await supabase
                    .from('ai_evaluations')
                    .select('id, score, explanation, submitted_resources(url)')
                    .eq('match_id', matchId)
                    .order('id', { ascending: true });

                console.log("rawEvals", rawEvals);

                if (evError) throw evError;

                const normEvals: Evaluation[] = (rawEvals ?? []).map((e: any) => ({
                    id: e.id,
                    score: e.score,
                    explanation: e.explanation,
                    url: e.submitted_resources.url ?? '',
                  }));
                  
                setEvaluations(normEvals || []);

                // 4) Si no se obtuvo total en la evaluación, calcularlo localmente
                if (total === null) {
                    const sum = (normEvals || []).reduce((acc, e) => acc + e.score, 0);
                    setTotal(sum);
                }

                // 5) Obtener leaderboard
                const resLeaderboard = await fetch('/api/leaderboard');
                if (resLeaderboard.ok) {
                    const { leaderboard } = await resLeaderboard.json();
                    setLeaderboard(leaderboard);
                }

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        runEvaluationFlow().finally(() => {
            evalInProgress.current = false;
        });
    }, [matchId]);

    if (loading) {
        return <p className="p-4">Evaluando tus recursos y cargando resultados…</p>;
    }
    if (error) {
        return <p className="p-4 text-red-600">Error: {error}</p>;
    }

    return (
        <main className="max-w-2xl mx-auto p-4 space-y-6">
            <h1 className="text-3xl font-bold">Resultados de tu partida</h1>

            <section>
                <h2 className="text-xl font-semibold">Puntaje total: {total}</h2>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-2">Evaluaciones detalladas</h2>
                <table className="w-full table-auto border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2 text-left">Recurso (URL)</th>
                            <th className="border p-2">Puntaje</th>
                            <th className="border p-2">Justificación</th>
                        </tr>
                    </thead>
                    <tbody>
                        {evaluations.map((e) => (
                            <tr key={e.id}>
                                <td className="border p-2 break-all">{e.url}</td>
                                <td className="border p-2 text-center">{e.score}</td>
                                <td className="border p-2">{e.explanation}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-2">Leaderboard global</h2>
                <ol className="list-decimal list-inside space-y-1">
                    {leaderboard.map((p, i) => (
                        <li key={i}>
                            <strong>{p.username}</strong> — {p.score}
                        </li>
                    ))}
                </ol>
            </section>

            <section className="flex gap-4">
                <button
                    onClick={() => router.push('/play')}
                    className="flex-1 bg-blue-600 text-white rounded p-2"
                >
                    Jugar de nuevo
                </button>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 border border-blue-600 text-blue-600 rounded p-2"
                >
                    Ver dashboard
                </button>
            </section>
        </main>
    );
}
