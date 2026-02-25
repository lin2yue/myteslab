export interface OperationCampaign {
    id: string;
    name?: string;
    status?: string;
    frequency_cap?: { per_user_per_day?: number };
    trigger_config?: Record<string, unknown>;
    content?: Record<string, unknown>;
    action_config?: Record<string, unknown>;
}

export function asString(value: unknown, fallback = '') {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
}

export function asBool(value: unknown, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

export function asStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

export function ensureViewerKey() {
    const keyName = 'ops_viewer_key';
    const existing = localStorage.getItem(keyName);
    if (existing) return existing;
    const created = `vk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(keyName, created);
    return created;
}

function getDayKey() {
    return new Date().toISOString().slice(0, 10);
}

export function readDisplayCount(campaignId: string) {
    const key = `ops_campaign_display:${campaignId}:${getDayKey()}`;
    return Number(localStorage.getItem(key) || 0);
}

export function bumpDisplayCount(campaignId: string) {
    const key = `ops_campaign_display:${campaignId}:${getDayKey()}`;
    const current = Number(localStorage.getItem(key) || 0);
    localStorage.setItem(key, String(current + 1));
}

export function hasEverShown(campaignId: string) {
    const key = `ops_campaign_seen_once:${campaignId}`;
    return localStorage.getItem(key) === '1';
}

export function markShownOnce(campaignId: string) {
    const key = `ops_campaign_seen_once:${campaignId}`;
    localStorage.setItem(key, '1');
}

export function canDisplayCampaign(campaign: OperationCampaign) {
    const perDayCap = Math.max(1, Math.floor(Number(campaign.frequency_cap?.per_user_per_day || 1)));
    const displayed = readDisplayCount(campaign.id);
    if (displayed >= perDayCap) return false;

    const firstShowOnly = asBool(campaign.trigger_config?.first_show_only, false);
    if (firstShowOnly && hasEverShown(campaign.id)) return false;

    return true;
}

export function markCampaignDisplayed(campaign: OperationCampaign) {
    bumpDisplayCount(campaign.id);
    if (asBool(campaign.trigger_config?.first_show_only, false)) {
        markShownOnce(campaign.id);
    }
}
