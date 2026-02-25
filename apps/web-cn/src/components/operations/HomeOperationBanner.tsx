'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    asString,
    canDisplayCampaign,
    ensureViewerKey,
    markCampaignDisplayed,
    type OperationCampaign,
} from './client-utils';

export function HomeOperationBanner() {
    const router = useRouter();
    const [campaign, setCampaign] = useState<OperationCampaign | null>(null);

    useEffect(() => {
        let disposed = false;
        const load = async () => {
            const viewerKey = ensureViewerKey();
            const res = await fetch(`/api/operations/placement?placement=home_banner&viewerKey=${encodeURIComponent(viewerKey)}`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success || !data?.campaign) return;
            const next = data.campaign as OperationCampaign;
            if (!canDisplayCampaign(next)) return;
            if (disposed) return;
            setCampaign(next);
            markCampaignDisplayed(next);
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
            title: asString(content.title, campaign?.name || '活动进行中'),
            subtitle: asString(content.subtitle),
            ctaText: asString(content.cta_text, '查看活动'),
            actionType: asString(action.type, 'none'),
            target: asString(action.target),
        };
    }, [campaign]);

    if (!campaign) return null;

    const onClick = () => {
        if (viewModel.actionType === 'internal_link' && viewModel.target) {
            router.push(viewModel.target);
            return;
        }
        if (viewModel.actionType === 'external_link' && viewModel.target) {
            window.open(viewModel.target, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className="mb-6 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-sm cursor-pointer"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-900 truncate">{viewModel.title}</p>
                    {viewModel.subtitle ? <p className="text-xs text-amber-700 mt-0.5 truncate">{viewModel.subtitle}</p> : null}
                </div>
                <span className="inline-flex h-8 items-center rounded-full bg-amber-600 px-3 text-xs font-semibold text-white shrink-0">
                    {viewModel.ctaText}
                </span>
            </div>
        </div>
    );
}
