import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const status = searchParams.get('status') || 'all';
    const publicFilter = searchParams.get('public') || 'all';
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const pageSize = Math.min(Number(searchParams.get('pageSize') || 12), 50);

    const params: any[] = [];
    const where: string[] = [];

    if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        where.push(`(w.name ILIKE $${idx} OR w.model_slug ILIKE $${idx} OR p.display_name ILIKE $${idx} OR p.email ILIKE $${idx})`);
    }
    if (category !== 'all') {
        params.push(category);
        where.push(`w.category = $${params.length}`);
    }
    if (status === 'active') {
        where.push('w.is_active = true');
    } else if (status === 'hidden') {
        where.push('w.is_active = false');
    }
    if (publicFilter === 'public') {
        where.push('w.is_public = true');
    } else if (publicFilter === 'private') {
        where.push('w.is_public = false');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    params.push(pageSize);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const sql = `
        SELECT
            w.id,
            w.name,
            w.model_slug,
            w.category,
            w.preview_url,
            w.is_active,
            w.is_public,
            w.created_at,
            p.display_name AS profile_display_name,
            p.email AS profile_email
        FROM wraps w
        LEFT JOIN profiles p ON p.id = w.user_id
        ${whereSql}
        ORDER BY w.created_at DESC
        LIMIT $${limitIdx}
        OFFSET $${offsetIdx}
    `;

    const { rows } = await dbQuery(sql, params);
    const wraps = rows.map((row: any) => ({
        ...row,
        profiles: row.profile_display_name || row.profile_email ? {
            display_name: row.profile_display_name,
            email: row.profile_email,
        } : null
    }));

    return NextResponse.json({ success: true, wraps });
}

