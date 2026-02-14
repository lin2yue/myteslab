import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { updateUserInfo } from '@/lib/auth/users';

export async function POST(request: Request) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const displayName = (body?.displayName as string | undefined)?.trim();

    if (!displayName) {
        return NextResponse.json({ success: false, error: 'Missing display name' }, { status: 400 });
    }

    await updateUserInfo(user.id, { displayName });

    return NextResponse.json({ success: true });
}

