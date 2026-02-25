'use client';

import { useState, useEffect, type KeyboardEvent } from 'react';
import { useTranslations } from '@/lib/i18n';
import { deleteGeneratedWrap, updateWrapVisibility, updateWrapTitle, updateWrapPrice } from '@/lib/profile-actions';
import { deleteUserAccount } from '@/lib/auth-actions';
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage';
import { useAlert } from '@/components/alert/AlertProvider';
import PublishModal, { type MarketplaceOptions } from '@/components/publish/PublishModal';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Portal from '@/components/Portal';
import { MoreHorizontal, Eye, Download, X } from 'lucide-react';

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
    browse_count?: number | null;
    download_count?: number | null;
    user_download_count?: number | null;
    price_credits?: number | null;
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
        id: string;
        name: string;
        preview_url: string;
    } | null;
}

interface ProfileContentProps {
    generatedWraps: Wrap[];
    downloads: DownloadItem[];
    wrapModels: ModelConfig[]; // Added wrapModels
    isCreator?: boolean;
}

const MAX_WRAP_TITLE_LENGTH = 200;

export default function ProfileContent({ generatedWraps, downloads, wrapModels, isCreator = false }: ProfileContentProps) {
    const t = useTranslations('Profile');
    const tCommon = useTranslations('Common');
    const alert = useAlert();
    const [activeTab, setActiveTab] = useState<'creations' | 'downloads'>('creations');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [wraps, setWraps] = useState(generatedWraps);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
    const [editingWrap, setEditingWrap] = useState<Wrap | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

    // Publish Modal State
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [activePublishWrap, setActivePublishWrap] = useState<Wrap | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // Pricing Modal State
    const [pricingWrap, setPricingWrap] = useState<Wrap | null>(null);
    const [pendingPrice, setPendingPrice] = useState<number>(30);
    const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

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

    const openEditTitleModal = (wrap: Wrap) => {
        setEditingWrap(wrap);
        setEditingTitle((wrap.name || wrap.prompt || '').trim());
    };

    const closeEditTitleModal = () => {
        if (isUpdatingTitle) return;
        setEditingWrap(null);
        setEditingTitle('');
    };

    const handleUpdateTitle = async () => {
        if (!editingWrap) return;
        const normalizedTitle = editingTitle.trim();

        if (!normalizedTitle) {
            alert.error(t('title_required'));
            return;
        }

        if (normalizedTitle.length > MAX_WRAP_TITLE_LENGTH) {
            alert.error(t('title_too_long', { max: MAX_WRAP_TITLE_LENGTH }));
            return;
        }

        setIsUpdatingTitle(true);
        try {
            const updatedTitle = await updateWrapTitle(editingWrap.id, normalizedTitle);
            setWraps(current => current.map(w => w.id === editingWrap.id ? { ...w, name: updatedTitle } : w));
            alert.success(t('title_update_success'));
            setEditingWrap(null);
            setEditingTitle('');
        } catch (e) {
            console.error(e);
            alert.error(t('title_update_failed'));
        } finally {
            setIsUpdatingTitle(false);
        }
    };

    const handleEditTitleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!isUpdatingTitle) {
                handleUpdateTitle();
            }
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            closeEditTitleModal();
        }
    };


    const handleDelete = async (id: string) => {
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

    const handleUpdatePrice = async () => {
        if (!pricingWrap) return;
        setIsUpdatingPrice(true);
        try {
            await updateWrapPrice(pricingWrap.id, pendingPrice);
            setWraps(wraps.map(w => w.id === pricingWrap.id ? { ...w, price_credits: pendingPrice } : w));
            alert.success(pendingPrice === 0 ? '已设为免费下载' : `定价已更新为 ${pendingPrice} 积分`);
            setPricingWrap(null);
        } catch (e) {
            console.error(e);
            alert.error('定价更新失败，请重试');
        } finally {
            setIsUpdatingPrice(false);
        }
    };

    const confirmPublish = async (previewImageBase64: string, marketplaceOptions?: MarketplaceOptions) => {
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
                    ossKey: ossKey,
                    marketplaceOptions
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
        <Card className="overflow-hidden max-w-[1440px] mx-auto">
            {/* Tabs */}
            <div className="border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-950/60 backdrop-blur">
                <nav className="flex px-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('creations')}
                        className={`py-4 px-6 text-sm font-bold transition-all relative ${activeTab === 'creations'
                            ? 'text-gray-950 dark:text-white'
                            : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                            }`}
                    >
                        {t('generated_wraps')}
                        {activeTab === 'creations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('downloads')}
                        className={`py-4 px-6 text-sm font-bold transition-all relative ${activeTab === 'downloads'
                            ? 'text-gray-950 dark:text-white'
                            : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                            }`}
                    >
                        {t('download_history')}
                        {activeTab === 'downloads' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white" />}
                    </button>
                </nav>
            </div>

            <div className="p-6">
                {/* My Creations Tab */}
                {activeTab === 'creations' && (
                    <div>
                        {wraps && wraps.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                                {wraps.map((wrap) => {
                                    const wrapSlug = wrap.slug || wrap.id;
                                    const isMenuOpen = openMenuId === wrap.id;
                                    return (
                                        <Card
                                            key={wrap.id}
                                            variant="muted"
                                            className={`rounded-xl overflow-visible hover:border-black/15 dark:hover:border-white/15 transition-all group/card flex flex-col relative ${isMenuOpen ? 'z-40' : 'z-0'}`}
                                        >
                                            {wrapSlug ? (
                                                <Link href={`/wraps/${wrapSlug}`} className="block">
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
                                                            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-[10px]">
                                                                No Images
                                                            </div>
                                                        )}
                                                        {wrap.is_public && (
                                                            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                                                                <div className="bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                                    {t('published')}
                                                                </div>
                                                                {(wrap.price_credits ?? 0) > 0 && (
                                                                    <div className="bg-amber-500/95 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                                        {wrap.price_credits}积分下载
                                                                    </div>
                                                                )}
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
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-[10px]">
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
                                                    {wrapSlug ? (
                                                        <Link href={`/wraps/${wrapSlug}`} className="block">
                                                            <p className="text-sm text-gray-900 dark:text-zinc-100 font-bold line-clamp-1 mb-4 hover:underline transition-colors" title={wrap.name || wrap.prompt || ''}>
                                                                {wrap.name || wrap.prompt || tCommon('untitled')}
                                                            </p>
                                                        </Link>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 font-bold line-clamp-1 mb-4 cursor-default" title={wrap.name || wrap.prompt || ''}>
                                                            {wrap.name || wrap.prompt || tCommon('untitled')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    {wrap.is_public ? (
                                                        <div className="text-[11px] text-gray-500 space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <div className="font-semibold text-green-700 dark:text-green-400">{t('published')}</div>
                                                                {(wrap.price_credits ?? 0) > 0 && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold">
                                                                        {wrap.price_credits}积分下载
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="inline-flex items-center gap-1"><Eye size={12} /> {wrap.browse_count ?? 0}</span>
                                                                <span className="inline-flex items-center gap-1"><Download size={12} /> {wrap.user_download_count ?? wrap.download_count ?? 0}</span>
                                                            </div>
                                                        </div>
                                                    ) : <div />}
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setOpenMenuId(openMenuId === wrap.id ? null : wrap.id)}
                                                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200/80 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
                                                            title="More"
                                                        >
                                                            <MoreHorizontal size={16} />
                                                        </button>
                                                        {openMenuId === wrap.id && (
                                                            <div className="absolute right-0 mt-2 z-50 w-36 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        openEditTitleModal(wrap);
                                                                    }}
                                                                    disabled={loadingId === wrap.id}
                                                                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                                                                >
                                                                    {t('edit_title')}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        handleTogglePublish(wrap);
                                                                    }}
                                                                    disabled={loadingId === wrap.id}
                                                                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                                                                >
                                                                    {wrap.is_public ? t('unpublish') : t('publish')}
                                                                </button>
                                                                {isCreator && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setOpenMenuId(null);
                                                                            setPendingPrice(wrap.price_credits ?? 0);
                                                                            setPricingWrap(wrap);
                                                                        }}
                                                                        disabled={loadingId === wrap.id}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50"
                                                                    >
                                                                        修改定价
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        setPendingDeleteId(wrap.id);
                                                                    }}
                                                                    disabled={loadingId === wrap.id}
                                                                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                                                                >
                                                                    {t('delete')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-24 text-gray-400 dark:text-zinc-500 font-medium text-sm">
                                {t('no_generated_wraps')}
                            </div>
                        )}
                    </div>
                )}

                {/* Downloads Tab */}
                {activeTab === 'downloads' && (
                    <div>
                        {downloads && downloads.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                                {downloads.map((item) => (
                                    <Card key={item.id} variant="muted" className="rounded-xl overflow-hidden hover:border-black/15 dark:hover:border-white/15 transition-all">
                                        {item.wraps?.id ? (
                                            <Link href={`/wraps/${item.wraps.id}`} className="block">
                                                <div className="relative aspect-square overflow-hidden">
                                                    {item.wraps?.preview_url ? (
                                                        <ResponsiveOSSImage
                                                            src={item.wraps.preview_url}
                                                            alt={item.wraps.name}
                                                            fill
                                                            className="object-cover transition-transform duration-500 hover:scale-105"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300 bg-black/5 dark:bg-white/10">
                                                            <span className="text-[10px] font-bold">NO IMG</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-3">
                                                    <div className="text-sm font-bold text-gray-950 dark:text-zinc-100 line-clamp-1">
                                                        {item.wraps?.name || 'Unknown Wrap'}
                                                    </div>
                                                    <div className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mt-1">
                                                        {new Date(item.downloaded_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="block">
                                                <div className="relative aspect-square overflow-hidden">
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-black/5 dark:bg-white/10">
                                                        <span className="text-[10px] font-bold">NO IMG</span>
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <div className="text-sm font-bold text-gray-500 line-clamp-1">Unknown Wrap</div>
                                                    <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mt-1">
                                                        {new Date(item.downloaded_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500 dark:text-zinc-400">
                                {t('no_downloads')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div className="border-t border-black/5 dark:border-white/10 p-8 bg-white/70 dark:bg-zinc-950/60 backdrop-blur">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{t('danger_zone')}</h3>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{t('delete_account_desc')}</p>
                    </div>
                    <button
                        onClick={() => setConfirmDeleteAccount(true)}
                        disabled={loadingId === 'delete_account'}
                        className="px-6 py-2.5 bg-white/80 dark:bg-zinc-900/50 border border-red-200/60 dark:border-red-900/30 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-800 transition-all disabled:opacity-50 backdrop-blur"
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
                    isCreator={isCreator}
                />
            )}

            {editingWrap && (
                <Portal>
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeEditTitleModal} />

                        <div className="relative w-full max-w-md bg-white/90 dark:bg-zinc-900/80 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 backdrop-blur">
                            <button
                                onClick={closeEditTitleModal}
                                disabled={isUpdatingTitle}
                                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-black/5 disabled:opacity-50"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>

                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('edit_title')}</h3>
                                <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">{t('edit_title_desc')}</p>
                            </div>

                            <div className="mt-4">
                                <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(event) => setEditingTitle(event.target.value)}
                                    onKeyDown={handleEditTitleInputKeyDown}
                                    maxLength={MAX_WRAP_TITLE_LENGTH}
                                    placeholder={t('title_placeholder')}
                                    className="w-full h-11 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
                                    autoFocus
                                />
                                <p className="mt-2 text-[11px] text-gray-400 dark:text-zinc-500 text-right">
                                    {editingTitle.trim().length}/{MAX_WRAP_TITLE_LENGTH}
                                </p>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeEditTitleModal}
                                    disabled={isUpdatingTitle}
                                    className="btn-secondary h-9 px-3 rounded-lg text-sm"
                                >
                                    {tCommon('cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUpdateTitle}
                                    disabled={isUpdatingTitle}
                                    className="btn-primary h-9 px-3 rounded-lg text-sm disabled:opacity-50"
                                >
                                    {isUpdatingTitle ? t('saving_title') : t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* 修改定价弹窗 */}
            {pricingWrap && (
                <Portal>
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isUpdatingPrice && setPricingWrap(null)} />
                        <div className="relative w-full max-w-sm bg-white/90 dark:bg-zinc-900/80 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 backdrop-blur">
                            <button
                                onClick={() => setPricingWrap(null)}
                                disabled={isUpdatingPrice}
                                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-black/5 disabled:opacity-50"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">修改定价</h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-5 leading-relaxed">
                                设置后，新用户下载需消耗充值积分，你获得 <span className="text-amber-600 dark:text-amber-400 font-semibold">70%</span> 收益
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                                {([
                                    { label: '免费', value: 0, desc: '0 积分' },
                                    { label: '30 积分', value: 30, desc: '¥9' },
                                    { label: '60 积分', value: 60, desc: '¥19' },
                                    { label: '120 积分', value: 120, desc: '¥39' },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPendingPrice(opt.value)}
                                        className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
                                            pendingPrice === opt.value
                                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                                : 'border-black/10 dark:border-white/10 hover:border-black/20 bg-white/50 dark:bg-zinc-800/50'
                                        }`}
                                    >
                                        <span className={`text-sm font-bold ${pendingPrice === opt.value ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-zinc-100'}`}>
                                            {opt.label}
                                        </span>
                                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                            {pendingPrice > 0 && (
                                <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                    你将获得 {Math.floor(pendingPrice * 0.7)} 积分 / 次下载
                                </p>
                            )}
                            <div className="mt-5 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPricingWrap(null)}
                                    disabled={isUpdatingPrice}
                                    className="btn-secondary h-9 px-3 rounded-lg text-sm"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUpdatePrice}
                                    disabled={isUpdatingPrice}
                                    className="btn-primary h-9 px-3 rounded-lg text-sm disabled:opacity-50"
                                >
                                    {isUpdatingPrice ? '保存中…' : '确认'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            <ConfirmDialog
                isOpen={!!pendingDeleteId}
                title={t('delete')}
                description={t('confirm_delete')}
                confirmText={t('delete')}
                cancelText={tCommon('cancel')}
                isDanger
                onCancel={() => setPendingDeleteId(null)}
                onConfirm={() => {
                    if (!pendingDeleteId) return;
                    const id = pendingDeleteId;
                    setPendingDeleteId(null);
                    handleDelete(id);
                }}
            />

            <ConfirmDialog
                isOpen={confirmDeleteAccount}
                title={t('delete_account')}
                description={t('delete_account_confirm')}
                confirmText={t('delete_account')}
                cancelText={tCommon('cancel')}
                isDanger
                onCancel={() => setConfirmDeleteAccount(false)}
                onConfirm={() => {
                    setConfirmDeleteAccount(false);
                    handleDeleteAccount();
                }}
            />
        </Card>
    );
}
