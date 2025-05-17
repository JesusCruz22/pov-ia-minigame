'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser, SignUpButton } from '@clerk/nextjs';
import supabase from '@/lib/supabaseClient';

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
    // User y su estado de carga
    const { user, isLoaded } = useUser();
    // Estado para saber si el usuario es anónimo
    const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
    
    useEffect(() => {
        if (!matchId) return;
        if (evalInProgress.current) return;
        evalInProgress.current = true;

        async function runEvaluationFlow() {
            setLoading(true);
            setError(null);

            try {
                // Comprobar si ya hay evaluaciones para esta partida
                const { data: existing, error: exError } = await supabase
                    .from('ai_evaluations')
                    .select('score, explanation, submitted_resources(url)')
                    .eq('match_id', matchId);

                if (exError) throw exError;

                if (existing && existing.length === 0) {
                    // Si no existen, lanzar la evaluación automática
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

                // Volver a obtener las evaluaciones completas
                const { data: rawEvals, error: evError } = await supabase
                    .from('ai_evaluations')
                    .select('id, score, explanation, submitted_resources(url)')
                    .eq('match_id', matchId)
                    .order('id', { ascending: true });

                if (evError) throw evError;

                const normEvals: Evaluation[] = (rawEvals ?? []).map((e: any) => ({
                    id: e.id,
                    score: e.score,
                    explanation: e.explanation,
                    url: e.submitted_resources.url ?? '',
                  }));
                
                setEvaluations(normEvals || []);

                // Si no se obtuvo total en la evaluación, calcularlo localmente
                if (total === null) {
                    const sum = (normEvals || []).reduce((acc, e) => acc + e.score, 0);
                    setTotal(sum);
                }

                // Obtener leaderboard
                let leaderboardUrl = '/api/leaderboard';
                // Si el usuario NO está autenticado, incluir el matchId anónimo para mostrar su posición
                const { data: matchData, error: matchError } = await supabase
                    .from('matches')
                    .select('user_id, is_anonymous')
                    .eq('id', matchId)
                    .single();
                if (matchError) throw matchError;

                const isAnon = !matchData?.user_id && matchData?.is_anonymous;
                if (isAnon) leaderboardUrl += `?includeMatchId=${matchId}`;

                const resLeaderboard = await fetch(leaderboardUrl);
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

        async function checkAnon() {
            const { data: matchData } = await supabase
                .from('matches')
                .select('user_id, is_anonymous')
                .eq('id', matchId)
                .single();
            
            setIsAnonymous(!matchData?.user_id && matchData?.is_anonymous);
        }

        if (matchId) checkAnon();
    }, [matchId]);

    if (loading) return <p className="p-4">Evaluando tus recursos y cargando resultados…</p>;
    if (error) return <p className="p-4 text-red-600">Error: {error}</p>;

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
                {isLoaded && isAnonymous ? (
                    <SignUpButton mode="modal">
                        <button
                            className="flex-1 bg-blue-600 text-white rounded p-2"
                        >
                            Registrate para guardar tu progreso
                        </button>
                    </SignUpButton>
                ) : (
                    <button
                        onClick={() => router.push('/play')}
                        className="flex-1 bg-blue-600 text-white rounded p-2"
                    >
                        Siguiente Desafío
                    </button>
                )}
                <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 border border-blue-600 text-blue-600 rounded p-2"
                >
                    Ir al Dashboard
                </button>
            </section>
        </main>
    );
}
