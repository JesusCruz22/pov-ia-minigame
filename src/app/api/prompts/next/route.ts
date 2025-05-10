import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function GET() {
    // Para empezar se devuelve un promtp de nivel 1.
    // Más adelante se pasará el nivel por query o por metadata de usuario.
    const { data: prompt, error } = await supabase
        .from('prompts')
        .select('id, title, description, level')
        .order('level', { ascending: true })
        .limit(1)
        .single();

    if (error || !prompt) {
        return NextResponse.json(
            { error: error?.message ?? 'Error al obtener el prompt' },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { prompt },
        { status: 200 }
    );
}
