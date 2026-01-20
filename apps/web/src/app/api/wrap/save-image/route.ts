import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Save generated wrap image to local filesystem
 * POST /api/wrap/save-image
 */
export async function POST(request: NextRequest) {
    try {
        const { imageBase64, filename } = await request.json();

        if (!imageBase64 || !filename) {
            return NextResponse.json(
                { success: false, error: 'Missing imageBase64 or filename' },
                { status: 400 }
            );
        }

        // Create directory if it doesn't exist
        // Resolve dev-studio path relative to apps/web (process.cwd())
        const devStudioDir = join(process.cwd(), '../../dev-studio/generated-wraps');
        if (!existsSync(devStudioDir)) {
            await mkdir(devStudioDir, { recursive: true });
        }

        // Remove data:image/png;base64, prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Save file
        const filepath = join(devStudioDir, filename);
        await writeFile(filepath, buffer);

        // Return serving URL via new API
        const publicUrl = `/api/debug/assets?file=${filename}`;

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filepath: filepath
        });

    } catch (error) {
        console.error('Error saving image:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to save image'
            },
            { status: 500 }
        );
    }
}
