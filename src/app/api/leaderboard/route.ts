import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const includeMatchId = url.searchParams.get('includeMatchId');
    const queryMatchId = includeMatchId ?
        `and(user_id.not.is.null,is_anonymous.not.eq.true),id.eq.${includeMatchId}` :
        'and(user_id.not.is.null,is_anonymous.eq.false)';

    const query = supabase
        .from('matches')
        .select('id, score_ai, user_id, is_anonymous, users(username)')
        .or(queryMatchId)
        .order('score_ai', { ascending: false });

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calcular total_score por usuario
    const leaderboard = data.reduce((acc: any, row: any) => {
        const user_id = row.user_id;
        const username = row.users?.username ?? 'Anónimo';
        const score = row.score_ai;
        if (!acc[user_id]) {
            acc[user_id] = { username, score: 0 };
        }
        acc[user_id].score += score;
        return acc;
    }, {} as Record<string, { username: string; score: number; user_id: string }>);

    return NextResponse.json({ leaderboard: Object.values(leaderboard) });
}