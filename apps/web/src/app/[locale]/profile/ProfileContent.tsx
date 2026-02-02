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
    wheel_url?: string;
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
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden max-w-[1600px] mx-auto">
            {/* Tabs */}
            <div className="border-b border-gray-100 bg-gray-50/20">
                <nav className="flex px-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('creations')}
                        className={`py-4 px-6 text-sm font-bold transition-all relative ${activeTab === 'creations'
                            ? 'text-gray-950'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {t('generated_wraps')}
                        {activeTab === 'creations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('downloads')}
                        className={`py-4 px-6 text-sm font-bold transition-all relative ${activeTab === 'downloads'
                            ? 'text-gray-950'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {t('download_history')}
                        {activeTab === 'downloads' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
                    </button>
                </nav>
            </div>

            <div className="p-6">
                {/* My Creations Tab */}
                {activeTab === 'creations' && (
                    <div>
                        {wraps && wraps.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                                {wraps.map((wrap) => (
                                    <div key={wrap.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-all group/card flex flex-col">
                                        {wrap.slug ? (
                                            <Link href={`/wraps/${wrap.slug}`} className="block">
                                                <div className="relative aspect-square overflow-hidden group">
                                                    {wrap.texture_url ? (
                                                        <ResponsiveOSSImage
                                                            src={wrap.texture_url}
                                                            alt={wrap.name || wrap.prompt || 'Generated Wrap'}
                                                            fill
                                                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-[10px]">
                                                            No Images
                                                        </div>
                                                    )}
                                                    {wrap.is_public && (
                                                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-10 uppercase tracking-wider">
                                                            {t('published')}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="relative aspect-square overflow-hidden cursor-default">
                                                {wrap.texture_url ? (
                                                    <ResponsiveOSSImage
                                                        src={wrap.texture_url}
                                                        alt={wrap.name || wrap.prompt || 'Generated Wrap'}
                                                        fill
                                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-[10px]">
                                                        No Images
                                                    </div>
                                                )}
                                                {wrap.is_public && (
                                                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-10 uppercase tracking-wider">
                                                        {t('published')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="p-4 flex flex-col flex-1">
                                            <div className="flex-1">
                                                {wrap.slug ? (
                                                    <Link href={`/wraps/${wrap.slug}`} className="block">
                                                        <p className="text-sm text-gray-900 font-bold line-clamp-1 mb-4 hover:text-blue-600 transition-colors" title={wrap.name || wrap.prompt || ''}>
                                                            {wrap.name || wrap.prompt || tCommon('untitled')}
                                                        </p>
                                                    </Link>
                                                ) : (
                                                    <p className="text-sm text-gray-400 font-bold line-clamp-1 mb-4 cursor-default" title={wrap.name || wrap.prompt || ''}>
                                                        {wrap.name || wrap.prompt || tCommon('untitled')}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex justify-between items-center gap-2">
                                                <button
                                                    onClick={() => handleTogglePublish(wrap)}
                                                    disabled={loadingId === wrap.id}
                                                    className={`flex-1 text-xs font-bold h-9 rounded-lg border transition-all ${wrap.is_public
                                                        ? 'border-gray-100 text-gray-400 hover:bg-gray-50'
                                                        : 'border-black bg-black text-white hover:bg-zinc-800'
                                                        }`}
                                                >
                                                    {loadingId === wrap.id ? '...' : (wrap.is_public ? t('unpublish') : t('publish'))}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(wrap.id)}
                                                    disabled={loadingId === wrap.id}
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-red-50 text-red-400 hover:bg-red-50 hover:border-red-100 transition-all text-xs"
                                                    title={t('delete')}
                                                >
                                                    {loadingId === wrap.id ? '...' : '✕'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-24 text-gray-400 font-medium text-sm">
                                {t('no_generated_wraps')}
                            </div>
                        )}
                    </div>
                )}

                {/* Downloads Tab */}
                {activeTab === 'downloads' && (
                    <div className="max-w-4xl mx-auto">
                        {downloads && downloads.length > 0 ? (
                            <ul className="space-y-3">
                                {downloads.map((item) => (
                                    <li key={item.id} className="p-4 flex items-center justify-between bg-white border border-gray-50 rounded-xl hover:border-gray-200 transition-all">
                                        <div className="flex items-center">
                                            <div className="h-14 w-14 flex-shrink-0 relative bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                                                {item.wraps?.preview_url ? (
                                                    <ResponsiveOSSImage
                                                        src={item.wraps.preview_url}
                                                        alt={item.wraps.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                        <span className="text-[10px] font-bold">NO IMG</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-950">{item.wraps?.name || 'Unknown Wrap'}</div>
                                                <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-1">{new Date(item.downloaded_at).toLocaleDateString()}</div>
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
            <div className="border-t border-gray-100 p-8 bg-gray-50/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">{t('danger_zone')}</h3>
                        <p className="text-xs text-gray-400 mt-1">{t('delete_account_desc')}</p>
                    </div>
                    <button
                        onClick={handleDeleteAccount}
                        disabled={loadingId === 'delete_account'}
                        className="px-6 py-2.5 bg-white border border-red-100 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
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
