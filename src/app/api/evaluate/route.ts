import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { evaluateWithModel } from '@/lib/evaluateUtils';

interface Evaluation {
    match_id: string;
    resource_id: string;
    model_id: string;
    score: number;
    explanation: string;
}

export async function POST(request: Request) {
    try {
        // Leer body
        const { matchId } = await request.json();
        if (!matchId) {
            return NextResponse.json({ error: 'matchId requerido' }, { status: 400 });
        }

        // Verificar si ya existen evaluaciones para este matchId
        const { data: existingEvaluations, error: existingError } = await supabase
            .from('ai_evaluations')
            .select('id')
            .eq('match_id', matchId);
        if (existingError) {
            return NextResponse.json({ error: existingError.message }, { status: 500 });
        }
        if (existingEvaluations && existingEvaluations.length > 0) {
            // Ya existen evaluaciones, no insertar duplicados
            return NextResponse.json({ error: 'Evaluación ya existe para esta partida.' }, { status: 409 });
        }

        // Obtener modelo activo
        const { data: config } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['community_winner_model', 'default_ai_model']);

        const modelId = config?.find((c) => c.key === 'community_winner_model')?.value ||
            config?.find((c) => c.key === 'default_ai_model')?.value;

        const { data: model } = await supabase
            .from('ai_models')
            .select('*')
            .eq('id', modelId)
            .single();

        // Obtener promt id de la partida
        const { data: match } = await supabase
            .from('matches')
            .select('prompt_id')
            .eq('id', matchId)
            .single();

        // Obtener prompt y recursos
        const { data: promptData } = await supabase
            .from('prompts')
            .select('description')
            .eq('id', match?.prompt_id)
            .single();

        const { data: resources } = await supabase
            .from('submitted_resources')
            .select('id, url')
            .eq('match_id', matchId);

        if (!promptData || !resources) {
            return NextResponse.json(
                { error: 'Datos incompletos', match, promptData, resources },
                { status: 404 }
            );
        }

        const resourcesIds = resources.map((resource) => resource.id).join(', ');
        const resourcesUrls = resources.map((resource) => resource.url).join(', ');
        const evaluations = [];

        const prompt = `Evalúa los recursos asignando un score de 1 a 10 y una explicación de máximo 200 caracteres basándote en precisión técnica, complejidad, nivel de detalle, utilidad práctica, calidad de la fuente, claridad de exposición y complementariedad entre sí.No se permiten recursos repetidos. Problema: ${promptData.description}. Recursos: ${resourcesUrls}. IDs de recursos: ${resourcesIds}. Devuelve **únicamente un objeto JSON válido en una sola línea**, sin formato adicional, sin explicaciones, sin saltos de línea ni bloques de código. Ejemplo: {[resource_id]: {"score": x, "explanation": "y"}}`;
        const response = await evaluateWithModel(model, prompt);
        const responseJson = JSON.parse(response);

        for (const resource of resources) {
            const score = responseJson[resource.id].score;
            const explanation = responseJson[resource.id].explanation;

            evaluations.push({
                match_id: matchId,
                resource_id: resource.id,
                model_id: model.id,
                score,
                explanation,
            });
        }

        // Verificar si ya existen evaluaciones para el matchId antes de insertar
        const { data: existingEvaluationsBeforeInsert, error: existingErrorBeforeInsert } = await supabase
            .from('ai_evaluations')
            .select('id')
            .eq('match_id', matchId);
        if (existingErrorBeforeInsert) {
            return NextResponse.json({ error: existingErrorBeforeInsert.message }, { status: 500 });
        }

        if (existingEvaluationsBeforeInsert && existingEvaluationsBeforeInsert.length > 0) {
            // Ya existen evaluaciones, no insertar duplicados
            return NextResponse.json({ error: 'Evaluación ya existe para esta partida.' }, { status: 409 });
        }

        // Insertar evaluaciones
        const { error: insertError } = await supabase
            .from('ai_evaluations')
            .insert(evaluations);

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Calcular correctamente el total score
        let totalScore = 0;
        evaluations.forEach((evaluation) => {
            totalScore += evaluation.score;
        });

        // Actualizar puntaje en matches
        await supabase
            .from('matches')
            .update({ score_ai: totalScore })
            .eq('id', matchId);

        return NextResponse.json({ total: totalScore });
    } catch (error) {
        return NextResponse.json({ error: 'Error al evaluar recursos' }, { status: 500 });
    }
}