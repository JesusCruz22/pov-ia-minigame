import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
    // 1) Autenticación
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Obtener todos los prompt_id ya jugados por el usuario
    const { data: usedPrompts, error: usedError } = await supabase
        .from('matches')
        .select('prompt_id')
        .eq('user_id', userId);

    if (usedError) {
        return NextResponse.json({ error: usedError.message }, { status: 500 });
    }

    // 3) Preparar la consulta a 'prompts', excluyendo los jugados
    let query = supabase
        .from('prompts')
        .select('id, title, description, level')
        .order('level', { ascending: true });

    const usedPromptIds = (usedPrompts ?? []).map((m) => m.prompt_id);
    if (usedPromptIds.length > 0) {
        // Supabase espera un string "(1,2,3)" para el filtro IN
        query = query.not('id', 'in', `(${usedPromptIds.join(',')})`);
    }

    // 4) Traer el siguiente prompt
    const { data: nextPrompt, error: promptError } = await query
        .limit(1)
        .single();

    // 5) Si no hay más prompts, indicarlo
    if (promptError || !nextPrompt) {
        return NextResponse.json(
            { done: true, message: '¡Felicidades! Has completado todos los desafíos.' },
            { status: 200 }
        );
    }

    // 6) Devolver el prompt
    return NextResponse.json({ done: false, prompt: nextPrompt }, { status: 200 });
}