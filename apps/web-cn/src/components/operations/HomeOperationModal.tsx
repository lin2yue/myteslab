'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    asString,
    asStringArray,
    canDisplayCampaign,
    ensureViewerKey,
    markCampaignDisplayed,
    type OperationCampaign,
} from './client-utils';

export function HomeOperationModal() {
    const router = useRouter();
    const [campaign, setCampaign] = useState<OperationCampaign | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let disposed = false;

        const load = async () => {
            const viewerKey = ensureViewerKey();
            const res = await fetch(`/api/operations/placement?placement=home_modal&viewerKey=${encodeURIComponent(viewerKey)}`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success || !data?.campaign) return;

            const nextCampaign = data.campaign as OperationCampaign;
            const delaySec = Math.max(0, Math.floor(Number(nextCampaign.trigger_config?.delay_sec || 0)));
            if (!canDisplayCampaign(nextCampaign)) return;

            if (!disposed) {
                if (delaySec > 0) {
                    window.setTimeout(() => {
                        if (disposed) return;
                        setCampaign(nextCampaign);
                        setOpen(true);
                        markCampaignDisplayed(nextCampaign);
                    }, delaySec * 1000);
                } else {
                    setCampaign(nextCampaign);
                    setOpen(true);
                    markCampaignDisplayed(nextCampaign);
                }
            }
        };

        load().catch(() => {});
        return () => {
            disposed = true;
        };
    }, []);

    const viewModel = useMemo(() => {
        const content = campaign?.content || {};
        const action = campaign?.action_config || {};
        return {
            banner: asString(content.image_url),
            title: asString(content.title, campaign?.name || '活动进行中'),
            subtitle: asString(content.subtitle),
            description: asString(content.description),
            bullets: asStringArray(content.bullets),
            ctaText: asString(content.cta_text, '立即参与'),
            actionType: asString(action.type, 'none'),
            target: asString(action.target),
        };
    }, [campaign]);

    if (!campaign || !open) return null;

    const onClose = () => setOpen(false);

    const onAction = () => {
        const { actionType, target } = viewModel;
        if (actionType === 'internal_link' && target) {
            setOpen(false);
            router.push(target);
            return;
        }
        if (actionType === 'external_link' && target) {
            window.open(target, '_blank', 'noopener,noreferrer');
            setOpen(false);
            return;
        }
        setOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[10px]" onClick={onClose} />
            <div className="relative w-full max-w-[588px] overflow-hidden rounded-2xl bg-white shadow-[0px_4px_24px_0px_rgba(0,0,0,0.08)] border border-black/5">
                {viewModel.banner ? (
                    <img src={viewModel.banner} alt="活动横幅" className="h-[120px] w-full object-cover" />
                ) : (
                    <div className="h-[101px] w-full bg-[#15161c]" />
                )}
                <div className="p-8 space-y-4">
                    <div className="space-y-2 text-black">
                        <h3 className="text-[40px] leading-none font-semibold tracking-[-1px]">{viewModel.title}</h3>
                        {viewModel.subtitle ? <p className="text-base font-medium">{viewModel.subtitle}</p> : null}
                        {viewModel.description ? <p className="text-sm leading-6">{viewModel.description}</p> : null}
                        {viewModel.bullets.length > 0 ? (
                            <ul className="list-disc pl-5 text-sm leading-6 space-y-1">
                                {viewModel.bullets.map((line, idx) => (
                                    <li key={`${campaign.id}-line-${idx}`}>{line}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={onAction}
                            className="h-10 min-w-[120px] rounded-lg bg-black px-6 text-base font-semibold text-white"
                        >
                            {viewModel.ctaText}
                        </button>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="关闭活动弹窗"
                    className="absolute right-3 top-3 h-8 w-8 rounded-full bg-black/45 text-white"
                >
                    ×
                </button>
            </div>
        </div>
    );
}
