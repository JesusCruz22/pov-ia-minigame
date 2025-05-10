'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

type Prompt = { id: number; title: string; description: string; level: number };

export default function PlayPage() {
    const [prompt, setPrompt] = useState<Prompt | null>(null);
    const [urls, setUrls] = useState<string[]>(['']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { isLoaded, user } = useUser();

    useEffect(() => {
        async function loadPrompt() {
            const res = await fetch('/api/prompts/next');
            if (res.ok) {
                const { prompt } = await res.json();
                setPrompt(prompt);
            }
        }
        loadPrompt();
    }, []);

    const addField = () => {
        if (urls.length < 4) setUrls([...urls, '']);
    };
    const updateField = (i: number, value: string) => {
        const copy = [...urls];
        copy[i] = value;
        setUrls(copy);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt) return;
        setLoading(true);
        setError(null);

        try {
            const validUrls = urls.filter((u) => u.trim().length > 0);
            const res = await fetch('/api/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promptId: prompt.id, resources: validUrls }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error creando partida');
            // Redirige a la pantalla de evaluación/puntuación
            router.push(`/play/result/${json.matchId}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isLoaded) return <p className="p-4">Cargando usuario…</p>;
    if (!user) return <p className="p-4 text-red-600">Debes iniciar sesión para jugar.</p>;
    if (!prompt) return <p className="p-4">Cargando desafío…</p>;

    return (
        <main className="max-w-xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-2">
                Nivel {prompt.level}: {prompt.title}
            </h1>
            <p className="mb-4">{prompt.description}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                {urls.map((url, i) => (
                    <input
                        key={i}
                        type="url"
                        placeholder={`Recurso ${i + 1} (URL)`}
                        value={url}
                        onChange={(e) => updateField(i, e.target.value)}
                        className="w-full border rounded p-2"
                        required={i === 0}
                    />
                ))}

                {urls.length < 4 && (
                    <button
                        type="button"
                        onClick={addField}
                        className="text-blue-600 underline"
                    >
                        + Añadir otro recurso
                    </button>
                )}

                {error && <p className="text-red-600">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white rounded p-2 disabled:opacity-50"
                >
                    {loading ? 'Enviando…' : 'Enviar recursos'}
                </button>
            </form>
        </main>
    );
}
