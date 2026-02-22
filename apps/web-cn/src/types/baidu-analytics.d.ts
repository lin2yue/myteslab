export { };

declare global {
    type BaiduAnalyticsCommand = [command: string, ...args: unknown[]];

    interface Window {
        _hmt?: BaiduAnalyticsCommand[];
        __baiduAutoPageviewDisabled?: boolean;
    }
}
