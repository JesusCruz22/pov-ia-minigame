// src/app/api/matches/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import supabase from '@/lib/supabaseClient';

export async function POST(request: Request) {
    // 1) Autenticación
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2) Leer body
    const { promptId, resources }: { promptId: number; resources: string[] } =
        await request.json();

    if (!promptId || !resources || resources.length === 0) {
        return NextResponse.json({ error: 'Missing promptId or resources' }, { status: 400 });
    }

    // 3) Crear la partida (match)
    const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
            user_id: userId,
            prompt_id: promptId,
            // score_ai y score_community se completarán tras la evaluación
        })
        .select('id')
        .single();

    if (matchError || !match) {
        return NextResponse.json({ error: matchError?.message }, { status: 500 });
    }

    const matchId = match.id;

    // 4) Guardar cada recurso
    const toInsert = resources.map((url) => ({
        match_id: matchId,
        url,
    }));
    const { error: resError } = await supabase
        .from('submitted_resources')
        .insert(toInsert);

    if (resError) {
        return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    // 5) Devolver OK + matchId
    return NextResponse.json({ matchId });
}
