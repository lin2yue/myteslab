'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { deleteGeneratedWrap, updateWrapVisibility } from '@/lib/profile-actions';
import { deleteUserAccount } from '@/lib/auth-actions';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/images';
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage';
import { useAlert } from '@/components/alert/AlertProvider';
import PublishModal from '@/components/publish/PublishModal';
import { Link } from '@/i18n/routing';

interface Wrap {
    id: string;
    name?: string;
    prompt?: string | null;
    slug?: string; // Added slug
    texture_url: string;
    preview_url: string | null;
    is_public: boolean;
    created_at: string;
    model_slug: string; // Added model_slug
}

interface ModelConfig {
    slug: string;
    model_3d_url: string;
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
    generatedWraps: Wrap[];
    downloads: DownloadItem[];
    wrapModels: ModelConfig[]; // Added wrapModels
}

export default function ProfileContent({ generatedWraps, downloads, wrapModels }: ProfileContentProps) {
    const t = useTranslations('Profile');
    const tCommon = useTranslations('Common');
    const alert = useAlert();
    const [activeTab, setActiveTab] = useState<'creations' | 'downloads'>('creations');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [wraps, setWraps] = useState(generatedWraps);

    // Publish Modal State
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [activePublishWrap, setActivePublishWrap] = useState<Wrap | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    const getModelUrl = (slug: string) => {
        return wrapModels.find(m => m.slug === slug)?.model_3d_url || '';
    };

    const getWheelUrl = (slug: string) => {
        return wrapModels.find(m => m.slug === slug)?.wheel_url || '';
    };

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
            alert.error(t('delete_failed'));
        } finally {
            setLoadingId(null);
        }
    };

    const handleTogglePublish = async (wrap: Wrap) => {
        if (wrap.is_public) {
            // Unpublish - simple toggle is fine
            setLoadingId(wrap.id);
            try {
                await updateWrapVisibility(wrap.id, false);
                setWraps(wraps.map(w => w.id === wrap.id ? { ...w, is_public: false } : w));
                alert.success(t('update_success'));
            } catch (e) {
                console.error(e);
                alert.error(t('update_failed'));
            } finally {
                setLoadingId(null);
            }
        } else {
            // Publish - trigger 3D modal flow
            setActivePublishWrap(wrap);
            setShowPublishModal(true);
        }
    };

    const confirmPublish = async (previewImageBase64: string) => {
        if (!activePublishWrap) return;

        setIsPublishing(true);
        try {
            // 1. 获取预签名上传链接
            const signRes = await fetch('/api/wrap/get-upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wrapId: activePublishWrap.id })
            });
            const signData = await signRes.json();
            if (!signData.success) throw new Error(`get-upload-url failed: ${signData.error}`);

            const { uploadUrl, ossKey } = signData;

            // 2. 将 Base64 转换为 Blob 准备直传
            const base64Content = previewImageBase64.replace(/^data:image\/\w+;base64,/, '');
            const byteCharacters = atob(base64Content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });

            // 3. 客户端直传 OSS
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/png' }
            });

            if (!uploadRes.ok) throw new Error('OSS direct upload failed');

            // 4. 通知服务器确认
            const confirmRes = await fetch('/api/wrap/confirm-publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wrapId: activePublishWrap.id,
                    ossKey: ossKey
                })
            });

            const confirmData = await confirmRes.json();
            if (!confirmData.success) throw new Error(`confirm-publish failed: ${confirmData.error}`);

            // Update UI
            setWraps(wraps.map(w => w.id === activePublishWrap.id ? { ...w, is_public: true, preview_url: confirmData.previewUrl } : w));
            alert.success(tCommon('publish_success'));
            setShowPublishModal(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            alert.error(`发布失败: ${message}`);
            console.error('[Profile-Publish] Error:', err);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm(t('delete_account_confirm'))) return;
        setLoadingId('delete_account');
        try {
            await deleteUserAccount();
            // Redirect happens in action
        } catch (e) {
            console.error(e);
            alert.error(t('delete_failed'));
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden max-w-[1600px] mx-auto">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {wraps.map((wrap) => (
                                    <div key={wrap.id} className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        {wrap.slug ? (
                                            <Link href={`/wraps/${wrap.slug}`} className="block">
                                                <div className="relative aspect-square bg-gray-50 group">
                                                    {wrap.texture_url ? (
                                                        <ResponsiveOSSImage
                                                            src={wrap.texture_url}
                                                            alt={wrap.name || wrap.prompt || 'Generated Wrap'}
                                                            fill
                                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs">
                                                            No Images
                                                        </div>
                                                    )}
                                                    {wrap.is_public && (
                                                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full z-10">
                                                            {t('published')}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="relative aspect-square bg-gray-50 group cursor-default">
                                                {wrap.texture_url ? (
                                                    <ResponsiveOSSImage
                                                        src={wrap.texture_url}
                                                        alt={wrap.name || wrap.prompt || 'Generated Wrap'}
                                                        fill
                                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                        className="object-contain p-2"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs">
                                                        No Images
                                                    </div>
                                                )}
                                                {wrap.is_public && (
                                                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full z-10">
                                                        {t('published')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="p-4">
                                            {wrap.slug ? (
                                                <Link href={`/wraps/${wrap.slug}`} className="block">
                                                    <p className="text-sm text-gray-900 font-bold line-clamp-2 mb-4 h-10 hover:text-blue-600 transition-colors" title={wrap.name || wrap.prompt || ''}>
                                                        {wrap.name || wrap.prompt || tCommon('untitled')}
                                                    </p>
                                                </Link>
                                            ) : (
                                                <p className="text-sm text-gray-900 font-bold line-clamp-2 mb-4 h-10 text-gray-500 cursor-default" title={wrap.name || wrap.prompt || ''}>
                                                    {wrap.name || wrap.prompt || tCommon('untitled')}
                                                </p>
                                            )}

                                            <div className="flex justify-between items-center gap-2">
                                                <button
                                                    onClick={() => handleTogglePublish(wrap)}
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
                                                    <ResponsiveOSSImage
                                                        src={item.wraps.preview_url}
                                                        alt={item.wraps.name}
                                                        width={48}
                                                        height={48}
                                                        className="rounded-lg object-cover shadow-sm"
                                                    />
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

            {/* Danger Zone */}
            <div className="border-t border-gray-100 p-6 bg-red-50/30">
                <h3 className="text-sm font-bold text-red-600 mb-4">{t('danger_zone')}</h3>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-gray-900 font-medium">{t('delete_account')}</p>
                        <p className="text-xs text-gray-500 mt-1">{t('delete_account_desc')}</p>
                    </div>
                    <button
                        onClick={handleDeleteAccount}
                        disabled={loadingId === 'delete_account'}
                        className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        {loadingId === 'delete_account' ? t('deleting_account') : t('delete_account')}
                    </button>
                </div>
            </div>

            {/* Unified Publish Modal */}
            {showPublishModal && activePublishWrap && (
                <PublishModal
                    isOpen={showPublishModal}
                    onClose={() => setShowPublishModal(false)}
                    onConfirm={confirmPublish}
                    modelSlug={activePublishWrap.model_slug}
                    modelUrl={getModelUrl(activePublishWrap.model_slug)}
                    wheelUrl={getWheelUrl(activePublishWrap.model_slug)}
                    textureUrl={activePublishWrap.texture_url}
                    isPublishing={isPublishing}
                />
            )}
        </div>
    );
}
