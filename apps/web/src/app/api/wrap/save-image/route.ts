import { NextRequest, NextResponse } from 'next/server';
import { uploadToOSS } from '@/lib/oss';
import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

/**
 * Handle DIY wrap upload and save
 * POST /api/wrap/save-image
 * (I'm repurposing/adding logic to match front-end call)
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

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
        const { data: wrapData, error: dbError } = await supabase.from('wraps').insert({
            user_id: user.id,
            name: prompt,
            prompt: prompt,
            model_slug: modelSlug,
            texture_url: savedUrl,
            preview_url: savedUrl, // DIY simple preview is same as texture or we could capture from 3D later
            is_public: false,
            category: 'diy',
            slug: crypto.randomBytes(6).toString('hex')
        }).select('id, slug').single();

        if (dbError) {
            throw dbError;
        }

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
