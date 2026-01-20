import { NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic'; // Ensure no caching

/**
 * List generated wrap images
 * GET /api/wrap/history
 */
export async function GET() {
    try {
        // Log current directory for debugging
        console.log('[History API] CWD:', process.cwd());

        const assetsDir = join(process.cwd(), '../../dev-studio/generated-wraps');
        console.log('[History API] Assets path:', assetsDir);

        try {
            const files = await readdir(assetsDir);

            // Filter for images and sort by modification time (newest first)
            const fileStats = await Promise.all(
                files
                    .filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
                    .map(async (filename) => {
                        const stats = await stat(join(assetsDir, filename));
                        return {
                            filename,
                            mtime: stats.mtime.getTime(),
                            url: `/api/debug/assets?file=${filename}`
                        };
                    })
            );

            const sortedFiles = fileStats
                .sort((a, b) => b.mtime - a.mtime)
                .map(f => ({ filename: f.filename, url: f.url }));

            return NextResponse.json({
                success: true,
                files: sortedFiles
            });

        } catch (err) {
            console.warn('[History API] Directory read error (may be empty or not exist):', err);
            // If directory doesn't exist, return empty list
            return NextResponse.json({ success: true, files: [] });
        }

    } catch (error) {
        console.error('Error listing history:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to list history' },
            { status: 500 }
        );
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
