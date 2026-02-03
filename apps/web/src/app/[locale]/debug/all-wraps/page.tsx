import { createClient } from '@/utils/supabase/server';
import { getMaskUrl } from '@/lib/ai/mask-config';
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import ImageResolution from './ImageResolution';

export const revalidate = 0; // Disable cache for debug page

export default async function AllWrapsDebugPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const headerList = await headers();
    const host = headerList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const currentOrigin = `${protocol}://${host}`;

    const supabase = await createClient();
    const isLocal = process.env.NODE_ENV === 'development' || host?.includes('localhost') || host?.includes('127.0.0.1');

    if (!isLocal) {
        notFound();
    }

    // 1. Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return redirect({ href: '/login', locale });
    }

    // 2. Fetch all generated wraps across all users
    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        return (
            <div className="p-8 text-red-500">
                <h1>Error fetching wraps</h1>
                <pre>{JSON.stringify(error, null, 2)}</pre>
            </div>
        );
    }

    const tCommon = await getTranslations('Common');
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club';

    const getCdnUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('data:')) return url;
        if (url.startsWith('/')) return url;
        if (url.includes('aliyuncs.com')) {
            try {
                const urlObj = new URL(url);
                return `${cdnUrl}${urlObj.pathname}${urlObj.search}`;
            } catch (e) {
                return url;
            }
        }
        return url;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
            <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
                <div>
                    <h1 className="text-3xl font-bold">AI 生成历史全局看板 (DEBUG)</h1>
                    <p className="text-gray-400 mt-2">查看系统内所有用户生成的贴图记录（最新 100 条）</p>
                </div>
                <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-400">
                    Total Records: {wraps?.length || 0}
                </div>
            </header>

            <div className="overflow-x-auto shadow-2xl rounded-xl border border-gray-700">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-800 text-gray-300 uppercase text-xs font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">时间 / ID</th>
                            <th className="px-6 py-4">作者 / 车型</th>
                            <th className="px-6 py-4 max-w-xs">Prompt</th>
                            <th className="px-6 py-4 text-center">References (参考图)</th>
                            <th className="px-6 py-4 text-center">Mask (底稿)</th>
                            <th className="px-6 py-4 text-center">Stored Texture (贴图)</th>
                            <th className="px-6 py-4 text-center">Preview (预览图)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {wraps && wraps.map((wrap) => {
                            const maskUrl = getMaskUrl(wrap.model_slug, currentOrigin);

                            return (
                                <tr key={wrap.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-6 whitespace-nowrap">
                                        <div className="text-sm font-medium">{new Date(wrap.created_at).toLocaleString()}</div>
                                        <div className="text-[10px] text-gray-500 mt-1 font-mono">{wrap.id.substring(0, 13)}...</div>
                                    </td>
                                    <td className="px-6 py-6 whitespace-nowrap">
                                        <div className="text-sm font-semibold text-gray-200">{wrap.author_name}</div>
                                        <div className="text-xs text-gray-500 mt-1 uppercase tracking-tight">{wrap.model_slug}</div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <p className="text-sm text-gray-300 leading-relaxed max-w-xs break-words italic">
                                            "{wrap.prompt}"
                                        </p>
                                    </td>
                                    <td className="px-6 py-6 whitespace-nowrap">
                                        <div className="flex flex-wrap items-center justify-center gap-2 max-w-[200px]">
                                            {wrap.reference_images && Array.isArray(wrap.reference_images) && wrap.reference_images.length > 0 ? (
                                                wrap.reference_images.map((refUrl: string, idx: number) => (
                                                    <a key={idx} href={getCdnUrl(refUrl)} target="_blank" rel="noreferrer" className="block border border-gray-700 rounded overflow-hidden">
                                                        <ImageResolution
                                                            src={getCdnUrl(refUrl)}
                                                            alt={`ref-${idx}`}
                                                            containerClassName="w-12 h-12 flex flex-col items-center justify-between p-0.5 bg-gray-800"
                                                            className="max-w-full max-h-10 object-contain hover:scale-110 transition-transform"
                                                        />
                                                    </a>
                                                ))
                                            ) : (
                                                <span className="text-gray-600 text-[10px]">None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col items-center gap-2">
                                            <a href={maskUrl} target="_blank" rel="noreferrer" className="block border border-gray-700 rounded-lg overflow-hidden">
                                                <ImageResolution
                                                    src={maskUrl}
                                                    alt="mask"
                                                    containerClassName="w-32 h-32 flex flex-col items-center justify-between p-1 bg-gray-800"
                                                    className="max-w-full max-h-24 object-contain grayscale opacity-50 hover:opacity-100 transition-all shadow-inner"
                                                />
                                            </a>
                                            <div className="text-[9px] text-gray-500 font-mono text-center">Reference Mask</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 border-x border-gray-800/50">
                                        <div className="flex flex-col items-center gap-2">
                                            <a href={getCdnUrl(wrap.texture_url)} target="_blank" rel="noreferrer" className="block border border-gray-700 rounded-lg overflow-hidden">
                                                <ImageResolution
                                                    src={getCdnUrl(wrap.texture_url)}
                                                    alt="texture"
                                                    containerClassName="w-32 h-32 flex flex-col items-center justify-between p-1 bg-gray-800"
                                                    className="max-w-full max-h-24 object-contain shadow-inner"
                                                />
                                            </a>
                                            <div className="text-[8px] text-gray-400 font-mono break-all w-32 text-center line-clamp-1 hover:line-clamp-none transition-all">
                                                {wrap.texture_url.startsWith('data:') ? 'DATA_URL' : wrap.texture_url.split('/').pop()}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col items-center gap-2">
                                            {wrap.preview_url ? (
                                                <>
                                                    <a href={getCdnUrl(wrap.preview_url)} target="_blank" rel="noreferrer" className="block border border-gray-700 rounded-lg overflow-hidden">
                                                        <ImageResolution
                                                            src={getCdnUrl(wrap.preview_url)}
                                                            alt="preview"
                                                            containerClassName="w-32 h-32 flex flex-col items-center justify-between p-1 bg-gray-800"
                                                            className="max-w-full max-h-24 object-contain shadow-inner"
                                                        />
                                                    </a>
                                                    <div className="text-[8px] text-gray-400 font-mono break-all w-32 text-center line-clamp-1 hover:line-clamp-none transition-all">
                                                        {wrap.preview_url.startsWith('data:') ? 'DATA_URL' : wrap.preview_url.split('/').pop()}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-32 h-32 flex items-center justify-center text-gray-600 border border-dashed border-gray-700 rounded-lg text-xs">
                                                    NO PREVIEW
                                                </div>
                                            )}
                                            <div className={`mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${wrap.is_public ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                                {wrap.is_public ? 'Public' : 'Private'}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {wraps?.length === 0 && (
                <div className="text-center py-20 bg-gray-800/20 rounded-xl mt-4 border border-dashed border-gray-700">
                    <div className="text-6xl mb-4">🔍</div>
                    <div className="text-gray-400 text-xl font-medium">暂时没有生成记录</div>
                </div>
            )}

            <footer className="mt-12 text-center text-gray-600 text-xs">
                MyTesLab Debug Tools • 所有资源均来自生产环境 OSS/CDN
            </footer>
        </div>
    );
}
