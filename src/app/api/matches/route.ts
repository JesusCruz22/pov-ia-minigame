import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import supabase from '@/lib/supabaseClient';

export async function POST(request: Request) {
    // Obtener userId
    const { userId } = await auth()

    // Leer body
    const body = await request.json();
    const { promptId, resources, matchId, associateUserId } = body;

    // Si viene associateUserId y matchId, es para asociar partida anónima a usuario
    if (associateUserId && matchId) {
        // Actualizar match existente: asociar userId y volver pública
        const { error: updateError } = await supabase
            .from('matches')
            .update({ user_id: associateUserId, is_anonymous: false })
            .eq('id', matchId);
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
    }

    if (!promptId || !resources || resources.length === 0) {
        return NextResponse.json({ error: 'Missing promptId or resources' }, { status: 400 });
    }

    // Crear la partida (match)
    const isAnonymous = !userId;
    const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
            user_id: userId,
            prompt_id: promptId,
            is_anonymous: isAnonymous,
            // score_ai y score_community se completarán tras la evaluación
        })
        .select('id')
        .single();

    if (matchError || !match) {
        return NextResponse.json({ error: matchError?.message }, { status: 500 });
    }

    const newMatchId = match.id;

    // Guardar cada recurso
    const toInsert = resources.map((url: string) => ({
        match_id: newMatchId,
        url,
    }));
    const { error: resError } = await supabase
        .from('submitted_resources')
        .insert(toInsert);

    if (resError) {
        return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    // Devolver OK + matchId
    return NextResponse.json({ matchId: newMatchId });
}
