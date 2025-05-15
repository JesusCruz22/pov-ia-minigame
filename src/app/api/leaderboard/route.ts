import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
    // 1) Autenticación
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
        .from('matches')
        .select('score_ai, user_id, users(username)')
        .order('score_ai', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calcular total_score por usuario
    const leaderboard = data.reduce((acc, row: any) => {
        const username = row.users.username ?? 'unknown';
        const score = row.score_ai;
        if (!acc[username]) {
            acc[username] = { username, score: 0 };
        }
        acc[username].score += score;
        return acc;
    }, {} as Record<string, { username: string; score: number }>);

    return NextResponse.json({ leaderboard: Object.values(leaderboard) });
}