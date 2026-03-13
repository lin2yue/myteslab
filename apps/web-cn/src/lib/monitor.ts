/**
 * Guardian Monitor Client
 * 客户端与服务器通用监控上报工具
 */

export async function reportError(params: {
    error: string;
    stack?: string;
    context?: Record<string, any>;
    level?: 'info' | 'warn' | 'error' | 'fatal';
}) {
    try {
        // 在服务端，如果是 API 路由内部调用，可以直接 fetch 自己的 API
        // 在客户端，也可以 fetch 这个 API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const url = `${baseUrl}/api/monitor`;

        // 异步上报，不阻塞主流程
        void fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...params,
                timestamp: new Date().toISOString(),
            }),
        }).catch(e => {
            // 监控上报本身失败，打印到控制台避免彻底无迹可寻
            console.error('[GUARDIAN] Report failed:', e);
        });
    } catch (e) {
        console.error('[GUARDIAN] Report logic error:', e);
    }
}
