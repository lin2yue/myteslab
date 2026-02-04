import { NextRequest, NextResponse } from 'next/server';
import { uploadToOSS } from '@/lib/oss';
import crypto from 'crypto';
import { WRAP_CATEGORY } from '@/lib/constants/category';
import { buildSlugBase, ensureUniqueSlug } from '@/lib/slug';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

/**
 * Handle DIY wrap upload and save
 * POST /api/wrap/save-image
 * (I'm repurposing/adding logic to match front-end call)
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { modelSlug, imageBase64, prompt = 'DIY Sticker' } = await request.json();

        if (!modelSlug || !imageBase64) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        // 1. Prepare buffer
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // 2. Generate filename
        const hash = crypto.createHash('md5').update(imageBase64).digest('hex').substring(0, 8);
        const filename = `diy-${user.id.substring(0, 5)}-${hash}-${Date.now()}.png`;

        // 3. Upload to OSS
        let savedUrl: string;
        try {
            savedUrl = await uploadToOSS(buffer, filename, 'wraps/diy');
        } catch (ossErr) {
            console.error('OSS Upload failed:', ossErr);
            return NextResponse.json({ success: false, error: 'Failed to upload to OSS' }, { status: 500 });
        }

        // 4. Save to database
        const slugBase = buildSlugBase({ name: prompt, prompt, modelSlug });
        const slug = await ensureUniqueSlug(slugBase);
        const { rows } = await dbQuery(
            `INSERT INTO wraps (
                user_id, name, prompt, model_slug, texture_url, preview_url,
                is_public, category, slug
            ) VALUES (
                $1,$2,$3,$4,$5,$6,
                $7,$8,$9
            ) RETURNING id, slug`,
            [
                user.id,
                prompt,
                prompt,
                modelSlug,
                savedUrl,
                savedUrl,
                false,
                WRAP_CATEGORY.DIY,
                slug
            ]
        );
        const wrapData = rows[0];

        return NextResponse.json({
            success: true,
            wrapId: wrapData.id,
            url: savedUrl
        });

    } catch (error) {
        console.error('Error saving DIY wrap:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}
