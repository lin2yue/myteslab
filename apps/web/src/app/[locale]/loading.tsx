'use client'

export default function Loading() {
    return (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 w-full min-h-[60vh] flex flex-col items-center justify-center">
            {/* 顶部进度条感官优化 */}
            <div className="fixed top-0 left-0 right-0 h-[1px] z-50 overflow-hidden">
                <div className="h-full bg-blue-600 animate-progress origin-left"></div>
            </div>

            {/* 居中加载提示 */}
            <div className="flex flex-col items-center">
                <div className="w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            </div>

            <style jsx>{`
                @keyframes progress {
                    0% { transform: scaleX(0); }
                    50% { transform: scaleX(0.7); }
                    100% { transform: scaleX(1); }
                }
                .animate-progress {
                    animation: progress 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
