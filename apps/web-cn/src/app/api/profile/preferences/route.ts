import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

type PreferenceRow = {
    ai_generator_last_model: string | null;
};

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { rows } = await dbQuery<PreferenceRow>(
            `SELECT ai_generator_last_model
             FROM user_preferences
             WHERE user_id = $1
             LIMIT 1`,
            [user.id]
        );

        return NextResponse.json({
            success: true,
            preferences: {
                aiGeneratorLastModel: rows[0]?.ai_generator_last_model ?? null
            }
        });
    } catch (error) {
        console.error('[profile/preferences][GET] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch preferences' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const rawModel = body?.aiGeneratorLastModel;
        const aiGeneratorLastModel = typeof rawModel === 'string' ? rawModel.trim() : '';

        if (!aiGeneratorLastModel) {
            return NextResponse.json({ success: false, error: 'Missing aiGeneratorLastModel' }, { status: 400 });
        }

        if (aiGeneratorLastModel.length > 100) {
            return NextResponse.json({ success: false, error: 'aiGeneratorLastModel too long' }, { status: 400 });
        }

        const { rows } = await dbQuery<PreferenceRow>(
            `INSERT INTO user_preferences (user_id, ai_generator_last_model, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET
               ai_generator_last_model = EXCLUDED.ai_generator_last_model,
               updated_at = NOW()
             RETURNING ai_generator_last_model`,
            [user.id, aiGeneratorLastModel]
        );

        return NextResponse.json({
            success: true,
            preferences: {
                aiGeneratorLastModel: rows[0]?.ai_generator_last_model ?? aiGeneratorLastModel
            }
        });
    } catch (error) {
        console.error('[profile/preferences][POST] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to save preferences' }, { status: 500 });
    }
}
