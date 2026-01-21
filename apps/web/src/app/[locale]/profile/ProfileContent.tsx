'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { deleteGeneratedWrap, updateWrapVisibility } from '@/lib/profile-actions';
import Image from 'next/image';

interface GeneratedWrap {
    id: string;
    name?: string;
    prompt?: string | null;
    texture_url: string;
    preview_url: string | null;
    is_public: boolean;
    created_at: string;
}

interface DownloadItem {
    id: string;
    downloaded_at: string;
    wraps: {
        name: string;
        preview_url: string;
    } | null;
}

interface ProfileContentProps {
    generatedWraps: GeneratedWrap[];
    downloads: DownloadItem[];
}

export default function ProfileContent({ generatedWraps, downloads }: ProfileContentProps) {
    const t = useTranslations('Profile');
    const tCommon = useTranslations('Common');
    const [activeTab, setActiveTab] = useState<'creations' | 'downloads'>('creations');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [wraps, setWraps] = useState(generatedWraps);

    // Sync wraps with props (for server revalidation updates)
    useEffect(() => {
        setWraps(generatedWraps);
    }, [generatedWraps]);


    const handleDelete = async (id: string) => {
        if (!confirm(t('confirm_delete'))) return;
        setLoadingId(id);
        try {
            await deleteGeneratedWrap(id);
            setWraps(wraps.filter(w => w.id !== id));
            // No alert needed for delete as item executes visual removal immediately
        } catch (e) {
            console.error(e);
            alert(t('delete_failed'));
        } finally {
            setLoadingId(null);
        }
    };

    const handleTogglePublish = async (id: string, currentStatus: boolean) => {
        setLoadingId(id);
        try {
            await updateWrapVisibility(id, !currentStatus);
            setWraps(wraps.map(w => w.id === id ? { ...w, is_public: !currentStatus } : w));
            alert(t('update_success'));
        } catch (e) {
            console.error(e);
            alert(t('update_failed'));
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('creations')}
                        className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'creations'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        {t('generated_wraps')}
                    </button>
                    <button
                        onClick={() => setActiveTab('downloads')}
                        className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'downloads'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        {t('download_history')}
                    </button>
                </nav>
            </div>

            <div className="p-6">
                {/* My Creations Tab */}
                {activeTab === 'creations' && (
                    <div>
                        {wraps && wraps.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {wraps.map((wrap) => (
                                    <div key={wrap.id} className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        <div className="relative aspect-video bg-gray-100">
                                            {(wrap.preview_url || wrap.texture_url) ? (
                                                <Image
                                                    src={wrap.preview_url || wrap.texture_url}
                                                    alt={wrap.name || wrap.prompt || 'Generated Wrap'}
                                                    fill
                                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs">
                                                    No Images
                                                </div>
                                            )}
                                            {wrap.is_public && (
                                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                                    {t('published')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <p className="text-sm text-gray-900 font-bold line-clamp-2 mb-4 h-10" title={wrap.name || wrap.prompt || ''}>
                                                {wrap.name || wrap.prompt || tCommon('untitled')}
                                            </p>

                                            <div className="flex justify-between items-center gap-2">
                                                <button
                                                    onClick={() => handleTogglePublish(wrap.id, wrap.is_public)}
                                                    disabled={loadingId === wrap.id}
                                                    className={`flex-1 text-xs px-3 py-2 rounded border transition-colors ${wrap.is_public
                                                        ? 'border-yellow-500 text-yellow-600 hover:bg-yellow-50'
                                                        : 'border-blue-500 text-blue-600 hover:bg-blue-50'
                                                        }`}
                                                >
                                                    {loadingId === wrap.id ? '...' : (wrap.is_public ? t('unpublish') : t('publish'))}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(wrap.id)}
                                                    disabled={loadingId === wrap.id}
                                                    className="flex-1 text-xs px-3 py-2 rounded border border-red-500 text-red-600 hover:bg-red-50 transition-colors"
                                                >
                                                    {loadingId === wrap.id ? '...' : t('delete')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                {t('no_generated_wraps')}
                            </div>
                        )}
                    </div>
                )}

                {/* Downloads Tab */}
                {activeTab === 'downloads' && (
                    <div>
                        {downloads && downloads.length > 0 ? (
                            <ul className="divide-y divide-gray-200">
                                {downloads.map((item) => (
                                    <li key={item.id} className="py-4 flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="h-12 w-12 flex-shrink-0">
                                                {item.wraps?.preview_url ? (
                                                    <Image src={item.wraps.preview_url} alt={item.wraps.name} width={48} height={48} className="rounded object-cover" />
                                                ) : (
                                                    <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
                                                        <span className="text-gray-400 text-xs">No Img</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{item.wraps?.name || 'Unknown Wrap'}</div>
                                                <div className="text-sm text-gray-500">{new Date(item.downloaded_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div>
                                            {/* Download link or action could go here if needed */}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                {t('no_downloads')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
