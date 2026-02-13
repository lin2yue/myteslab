import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';

/**
 * SSE endpoint for real-time generation task updates.
 * Usage: GET /api/wrap/events?taskId=...
 */
export async function GET(request: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
        return new Response('Missing taskId', { status: 400 });
    }

    // Verify task ownership
    const { rows: taskRows } = await db().query(
        'SELECT user_id FROM generation_tasks WHERE id = $1',
        [taskId]
    );

    if (taskRows.length === 0) {
        return new Response('Task not found', { status: 404 });
    }

    if (taskRows[0].user_id !== user.id) {
        return new Response('Forbidden', { status: 403 });
    }

    const pool = db();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const client = await pool.connect();

            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            // Send initial ping
            sendEvent({ type: 'connected', taskId });

            try {
                // Listen for NOTIFY from the database
                await client.query('LISTEN generation_task_updates');

                client.on('notification', async (msg) => {
                    if (msg.channel === 'generation_task_updates' && msg.payload === taskId) {
                        try {
                            const { rows } = await client.query(
                                'SELECT id, status, steps, error_message FROM generation_tasks WHERE id = $1',
                                [taskId]
                            );
                            if (rows[0]) {
                                sendEvent({ type: 'update', task: rows[0] });

                                // If task is final, we could close but better let frontend decide or based on status
                                if (['completed', 'failed', 'failed_refunded'].includes(rows[0].status)) {
                                    // Keep open briefly to ensure last message is received? 
                                    // Or just let it be.
                                }
                            }
                        } catch (err) {
                            console.error('[SSE] DB fetch error:', err);
                        }
                    }
                });

                // Heartbeat to keep connection alive
                const heartbeat = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(': heartbeat\n\n'));
                    } catch (e) {
                        clearInterval(heartbeat);
                    }
                }, 15000);

                // Handle client disconnect
                request.signal.addEventListener('abort', () => {
                    clearInterval(heartbeat);
                    client.query('UNLISTEN generation_task_updates').catch(() => { });
                    client.release();
                    controller.close();
                });

            } catch (err) {
                console.error('[SSE] Setup error:', err);
                client.release();
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
