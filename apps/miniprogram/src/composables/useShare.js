import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';

/**
 * Standard Share Composable for Uni-App Vue 3
 * @param {Object|Function} options - Share configuration object or function returning it
 * @param {string} [options.title] - Share title (default: '特玩-锁车音效库')
 * @param {string} [options.path] - Share path (default: '/pages/index/index')
 * @param {string} [options.imageUrl] - Share image (default: '/static/share-cover.jpg')
 * @param {string} [options.query] - Query string for timeline (default: '')
 */
export function useShare(options = {}) {
    const DEFAULT_CONFIG = {
        title: '特玩-锁车音效库',
        path: '/pages/index/index',
        // imageUrl: '/static/share-cover.jpg', // Commented out to allow Page Screenshot (Default WeChat behavior)
        query: ''
    };

    onShareAppMessage(() => {
        console.log('🔗 useShare: onShareAppMessage triggered');
        const userConfig = typeof options === 'function' ? options() : options;
        const finalConfig = {
            title: userConfig.title || DEFAULT_CONFIG.title,
            path: userConfig.path || DEFAULT_CONFIG.path
        };

        // Only add imageUrl if explicitly provided or default exists
        if (userConfig.imageUrl || DEFAULT_CONFIG.imageUrl) {
            finalConfig.imageUrl = userConfig.imageUrl || DEFAULT_CONFIG.imageUrl;
        }

        console.log('🔗 Share Config:', finalConfig);
        return finalConfig;
    });

    onShareTimeline(() => {
        const userConfig = typeof options === 'function' ? options() : options;
        return {
            title: userConfig.title || DEFAULT_CONFIG.title,
            query: userConfig.query || DEFAULT_CONFIG.query,
            imageUrl: userConfig.imageUrl || DEFAULT_CONFIG.imageUrl
        };
    });
}
