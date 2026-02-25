'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Save, Plus, Copy, Archive, PauseCircle, ArchiveRestore, UploadCloud } from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

type PlacementKey =
    | 'home_modal'
    | 'home_banner'
    | 'wrap_list_slot'
    | 'generate_success_modal'
    | 'profile_task_card'
    | 'wrap_detail_cta';

type ActionType = 'none' | 'internal_link' | 'external_link';
type TriggerOn = 'page_view' | 'after_generate_success' | 'manual';

interface CampaignItem {
    id: string;
    name: string;
    placement_key: PlacementKey;
    status: CampaignStatus;
    start_at: string;
    end_at: string;
    traffic_ratio: number;
    priority: number;
    frequency_cap: { per_user_per_day: number };
    audience: Record<string, unknown>;
    trigger_config: Record<string, unknown>;
    content: Record<string, unknown>;
    action_config: Record<string, unknown>;
    archived_at: string | null;
    updated_at: string;
}

interface CampaignFormState {
    name: string;
    placement_key: PlacementKey;
    status: CampaignStatus;
    start_at: string;
    end_at: string;
    traffic_ratio: number;
    priority: number;
    per_user_per_day: number;

    audience_segments: string;
    audience_login_required: boolean;
    audience_device: 'all' | 'desktop' | 'mobile';

    trigger_on: TriggerOn;
    trigger_delay_sec: number;
    trigger_first_show_only: boolean;
    trigger_preview_enabled: boolean;
    trigger_preview_whitelist: string;

    content_title: string;
    content_subtitle: string;
    content_description: string;
    content_bullets: string;
    content_cta_text: string;
    content_image_url: string;

    action_type: ActionType;
    action_target: string;

    audience_extra_json: string;
    trigger_extra_json: string;
    content_extra_json: string;
    action_extra_json: string;
}

const placementOptions: Array<{ value: PlacementKey; label: string }> = [
    { value: 'home_modal', label: '首页弹窗' },
    { value: 'home_banner', label: '首页条幅' },
    { value: 'wrap_list_slot', label: '作品列表插槽' },
    { value: 'generate_success_modal', label: '生成成功弹窗' },
    { value: 'profile_task_card', label: '个人中心任务卡' },
    { value: 'wrap_detail_cta', label: '作品详情 CTA' },
];

function toDatetimeLocalValue(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoString(localDateTime: string): string | null {
    if (!localDateTime) return null;
    const date = new Date(localDateTime);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function parseJsonObject(text: string, fieldName: string): Record<string, unknown> {
    if (!text.trim()) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(`${fieldName} 不是合法 JSON`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${fieldName} 必须是 JSON 对象`);
    }
    return parsed as Record<string, unknown>;
}

function statusLabel(status: CampaignStatus) {
    if (status === 'active') return '进行中';
    if (status === 'paused') return '暂停';
    if (status === 'ended') return '已结束';
    return '草稿';
}

function statusClassName(status: CampaignStatus) {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'paused') return 'bg-amber-100 text-amber-700';
    if (status === 'ended') return 'bg-zinc-200 text-zinc-700';
    return 'bg-blue-100 text-blue-700';
}

function asString(value: unknown, fallback = '') {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
}

function asNumber(value: unknown, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function asBool(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value;
    return fallback;
}

function asStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function omitKeys(source: Record<string, unknown>, keys: string[]) {
    const next: Record<string, unknown> = {};
    const skip = new Set(keys);
    for (const [k, v] of Object.entries(source)) {
        if (!skip.has(k)) next[k] = v;
    }
    return next;
}

function defaultForm(): CampaignFormState {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
        name: '',
        placement_key: 'home_modal',
        status: 'draft',
        start_at: toDatetimeLocalValue(now),
        end_at: toDatetimeLocalValue(nextWeek),
        traffic_ratio: 100,
        priority: 0,
        per_user_per_day: 1,

        audience_segments: 'all',
        audience_login_required: false,
        audience_device: 'all',

        trigger_on: 'page_view',
        trigger_delay_sec: 0,
        trigger_first_show_only: false,
        trigger_preview_enabled: false,
        trigger_preview_whitelist: '',

        content_title: '发布涂装，送积分 赢好礼',
        content_subtitle: '',
        content_description: '',
        content_bullets: '',
        content_cta_text: '立即参与',
        content_image_url: '',

        action_type: 'internal_link',
        action_target: '/ai-generate/generate',

        audience_extra_json: '{}',
        trigger_extra_json: '{}',
        content_extra_json: '{}',
        action_extra_json: '{}',
    };
}

function campaignToForm(campaign: CampaignItem): CampaignFormState {
    const audience = campaign.audience || {};
    const triggerConfig = campaign.trigger_config || {};
    const content = campaign.content || {};
    const action = campaign.action_config || {};

    return {
        name: campaign.name,
        placement_key: campaign.placement_key,
        status: campaign.status,
        start_at: toDatetimeLocalValue(new Date(campaign.start_at)),
        end_at: toDatetimeLocalValue(new Date(campaign.end_at)),
        traffic_ratio: campaign.traffic_ratio,
        priority: campaign.priority,
        per_user_per_day: Number(campaign.frequency_cap?.per_user_per_day || 1),

        audience_segments: asStringArray(audience.segments).join(', '),
        audience_login_required: asBool(audience.login_required, false),
        audience_device: ['all', 'desktop', 'mobile'].includes(asString(audience.device, 'all'))
            ? asString(audience.device, 'all') as CampaignFormState['audience_device']
            : 'all',

        trigger_on: ['page_view', 'after_generate_success', 'manual'].includes(asString(triggerConfig.on, 'page_view'))
            ? asString(triggerConfig.on, 'page_view') as TriggerOn
            : 'page_view',
        trigger_delay_sec: Math.max(0, Math.floor(asNumber(triggerConfig.delay_sec, 0))),
        trigger_first_show_only: asBool(triggerConfig.first_show_only, false),
        trigger_preview_enabled: asBool(triggerConfig.preview_enabled, false),
        trigger_preview_whitelist: asStringArray(triggerConfig.preview_whitelist).join(', '),

        content_title: asString(content.title),
        content_subtitle: asString(content.subtitle),
        content_description: asString(content.description),
        content_bullets: asStringArray(content.bullets).join('\n'),
        content_cta_text: asString(content.cta_text),
        content_image_url: asString(content.image_url),

        action_type: ['none', 'internal_link', 'external_link'].includes(asString(action.type, 'none'))
            ? asString(action.type, 'none') as ActionType
            : 'none',
        action_target: asString(action.target),

        audience_extra_json: JSON.stringify(omitKeys(audience, ['segments', 'login_required', 'device']), null, 2),
        trigger_extra_json: JSON.stringify(omitKeys(triggerConfig, ['on', 'delay_sec', 'first_show_only', 'preview_enabled', 'preview_whitelist']), null, 2),
        content_extra_json: JSON.stringify(omitKeys(content, ['title', 'subtitle', 'description', 'bullets', 'cta_text', 'image_url']), null, 2),
        action_extra_json: JSON.stringify(omitKeys(action, ['type', 'target']), null, 2),
    };
}

function PreviewPanel({ form }: { form: CampaignFormState }) {
    const bullets = form.content_bullets
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);

    const activePlacementLabel = placementOptions.find((item) => item.value === form.placement_key)?.label || form.placement_key;

    return (
        <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 space-y-4 bg-gray-50/50 dark:bg-zinc-900/40">
            <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">实时预览</h3>
                <p className="text-xs text-gray-500 mt-1">当前运营位：{activePlacementLabel}</p>
            </div>

            <div className={cn('rounded-xl border p-3 bg-white overflow-hidden', form.placement_key === 'home_banner' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200')}>
                <p className="text-[11px] text-gray-400 mb-2">首页条幅</p>
                <div className="rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-amber-900 truncate">{form.content_title || '活动标题'}</p>
                            <p className="text-xs text-amber-700 mt-0.5 truncate">{form.content_subtitle || '活动副标题'}</p>
                        </div>
                        <span className="inline-flex h-7 items-center rounded-full bg-amber-600 px-3 text-xs font-semibold text-white shrink-0">
                            {form.content_cta_text || '查看活动'}
                        </span>
                    </div>
                </div>
            </div>

            <div className={cn('rounded-xl border p-3 bg-white', form.placement_key === 'wrap_list_slot' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200')}>
                <p className="text-[11px] text-gray-400 mb-2">作品列表插槽</p>
                <div className="rounded-2xl overflow-hidden border border-amber-200/70">
                    {form.content_image_url ? (
                        <img src={form.content_image_url} alt="slot preview" className="h-28 w-full object-cover" />
                    ) : (
                        <div className="h-28 bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100" />
                    )}
                    <div className="p-3 space-y-1">
                        <p className="text-sm font-bold line-clamp-1">{form.content_title || '活动标题'}</p>
                        <p className="text-xs text-gray-600 line-clamp-2">{form.content_description || form.content_subtitle || '活动说明'}</p>
                    </div>
                </div>
            </div>

            <div className={cn('rounded-xl border p-3 bg-white', form.placement_key === 'home_modal' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200')}>
                <p className="text-[11px] text-gray-400 mb-2">首页弹窗</p>
                <div className="rounded-2xl overflow-hidden border border-black/10 max-w-[360px] mx-auto bg-white shadow-sm">
                    {form.content_image_url ? (
                        <img src={form.content_image_url} alt="modal preview" className="h-20 w-full object-cover" />
                    ) : (
                        <div className="h-20 bg-[#15161c]" />
                    )}
                    <div className="p-4 space-y-2">
                        <p className="text-lg font-bold leading-tight">{form.content_title || '活动标题'}</p>
                        {form.content_subtitle ? <p className="text-xs text-gray-600">{form.content_subtitle}</p> : null}
                        {form.content_description ? <p className="text-xs text-gray-700 line-clamp-2">{form.content_description}</p> : null}
                        {bullets.length > 0 ? (
                            <ul className="list-disc pl-4 text-[11px] text-gray-700 space-y-0.5">
                                {bullets.map((line, idx) => (
                                    <li key={`pv-bullet-${idx}`}>{line}</li>
                                ))}
                            </ul>
                        ) : null}
                        <div className="pt-1 flex justify-center">
                            <span className="inline-flex h-8 items-center rounded-lg bg-black px-4 text-xs font-semibold text-white">
                                {form.content_cta_text || '立即参与'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminOperationsPage() {
    const alert = useAlert();
    const imageInputRef = useRef<HTMLInputElement | null>(null);

    const [listLoading, setListLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [form, setForm] = useState<CampaignFormState>(defaultForm());

    const selectedCampaign = useMemo(
        () => campaigns.find((item) => item.id === selectedId) || null,
        [campaigns, selectedId]
    );

    const fetchCampaigns = useCallback(async () => {
        setListLoading(true);
        try {
            const res = await fetch(`/api/admin/operations/campaigns?include_archived=${includeArchived ? '1' : '0'}`);
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || '加载活动失败');
            }
            const rows = Array.isArray(data.campaigns) ? data.campaigns as CampaignItem[] : [];
            setCampaigns(rows);
            setSelectedId((prev) => {
                if (prev && rows.some((row) => row.id === prev)) return prev;
                return rows[0]?.id || null;
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '加载活动失败';
            alert.error(message);
        } finally {
            setListLoading(false);
        }
    }, [alert, includeArchived]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    useEffect(() => {
        if (!selectedCampaign) return;
        setForm(campaignToForm(selectedCampaign));
    }, [selectedCampaign]);

    const handleImageUpload = async (file: File) => {
        const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
        const normalizedType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
        if (!allowedTypes.has(normalizedType)) {
            alert.error('仅支持 PNG/JPG/WEBP 图片');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert.error('图片大小不能超过 2MB');
            return;
        }

        setImageUploading(true);
        try {
            const signRes = await fetch('/api/admin/operations/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentType: normalizedType }),
            });
            const signData = await signRes.json();
            if (!signRes.ok || !signData?.success) {
                throw new Error(signData?.error || '获取上传地址失败');
            }

            const uploadRes = await fetch(signData.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': normalizedType },
            });
            if (!uploadRes.ok) {
                throw new Error('上传到 OSS 失败');
            }

            setForm((prev) => ({ ...prev, content_image_url: String(signData.publicUrl || '') }));
            alert.success('图片上传成功');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '上传失败';
            alert.error(message);
        } finally {
            setImageUploading(false);
            if (imageInputRef.current) {
                imageInputRef.current.value = '';
            }
        }
    };

    const validateAndBuildPayload = () => {
        const startAtIso = toIsoString(form.start_at);
        const endAtIso = toIsoString(form.end_at);
        if (!startAtIso || !endAtIso) {
            throw new Error('活动开始时间或结束时间格式无效');
        }
        if (new Date(endAtIso).getTime() <= new Date(startAtIso).getTime()) {
            throw new Error('结束时间必须晚于开始时间');
        }

        const audienceExtra = parseJsonObject(form.audience_extra_json, '人群扩展配置');
        const triggerExtra = parseJsonObject(form.trigger_extra_json, '触发扩展配置');
        const contentExtra = parseJsonObject(form.content_extra_json, '内容扩展配置');
        const actionExtra = parseJsonObject(form.action_extra_json, '动作扩展配置');

        const segments = form.audience_segments
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        const previewWhitelist = form.trigger_preview_whitelist
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);

        return {
            name: form.name.trim(),
            placement_key: form.placement_key,
            status: form.status,
            start_at: startAtIso,
            end_at: endAtIso,
            traffic_ratio: Math.max(0, Math.min(100, Math.floor(Number(form.traffic_ratio || 0)))),
            priority: Math.max(-999, Math.min(999, Math.floor(Number(form.priority || 0)))),
            frequency_cap: {
                per_user_per_day: Math.max(1, Math.min(100, Math.floor(Number(form.per_user_per_day || 1)))),
            },
            audience: {
                ...audienceExtra,
                segments: segments.length > 0 ? segments : ['all'],
                login_required: form.audience_login_required,
                device: form.audience_device,
            },
            trigger_config: {
                ...triggerExtra,
                on: form.trigger_on,
                delay_sec: Math.max(0, Math.floor(Number(form.trigger_delay_sec || 0))),
                first_show_only: form.trigger_first_show_only,
                preview_enabled: form.trigger_preview_enabled,
                preview_whitelist: previewWhitelist,
            },
            content: {
                ...contentExtra,
                title: form.content_title.trim(),
                subtitle: form.content_subtitle.trim(),
                description: form.content_description.trim(),
                bullets: form.content_bullets
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                cta_text: form.content_cta_text.trim(),
                image_url: form.content_image_url.trim(),
            },
            action_config: {
                ...actionExtra,
                type: form.action_type,
                target: form.action_target.trim(),
            },
        };
    };

    const createCampaign = async () => {
        setSaving(true);
        try {
            const payload = validateAndBuildPayload();
            if (!payload.name) throw new Error('活动名称不能为空');

            const res = await fetch('/api/admin/operations/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || '创建活动失败');
            }

            alert.success('活动已创建');
            await fetchCampaigns();
            if (data.campaign?.id) setSelectedId(String(data.campaign.id));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '创建活动失败';
            alert.error(message);
        } finally {
            setSaving(false);
        }
    };

    const updateCampaign = async () => {
        if (!selectedId) {
            alert.error('请先选择活动');
            return;
        }

        setSaving(true);
        try {
            const payload = validateAndBuildPayload();
            if (!payload.name) throw new Error('活动名称不能为空');

            const res = await fetch(`/api/admin/operations/campaigns/${selectedId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || '保存活动失败');
            }

            alert.success('活动已保存');
            await fetchCampaigns();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '保存活动失败';
            alert.error(message);
        } finally {
            setSaving(false);
        }
    };

    const runItemAction = async (action: 'duplicate' | 'offline' | 'archive' | 'unarchive') => {
        if (!selectedId) {
            alert.error('请先选择活动');
            return;
        }

        setActionLoading(true);
        try {
            const res = await fetch(`/api/admin/operations/campaigns/${selectedId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || '活动操作失败');
            }

            if (action === 'duplicate' && data.campaign?.id) {
                setSelectedId(String(data.campaign.id));
                alert.success('活动已复制');
            } else if (action === 'offline') {
                alert.success('活动已下线');
            } else if (action === 'archive') {
                alert.success('活动已归档');
            } else {
                alert.success('活动已取消归档');
            }

            await fetchCampaigns();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '活动操作失败';
            alert.error(message);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">运营活动中心</h1>
                    <p className="text-sm text-gray-500 mt-1">精简版管理台：支持投放、复制、下线、归档，并预留扩展参数</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={includeArchived}
                            onChange={(e) => setIncludeArchived(e.target.checked)}
                            className="h-4 w-4"
                        />
                        包含已归档
                    </label>
                    <button
                        type="button"
                        onClick={fetchCampaigns}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700"
                    >
                        <RotateCcw className={cn('w-4 h-4', listLoading && 'animate-spin')} />
                        刷新
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                        <h2 className="text-sm font-semibold">活动列表</h2>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedId(null);
                                setForm(defaultForm());
                            }}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700"
                        >
                            <Plus className="w-3 h-3" />
                            新建
                        </button>
                    </div>
                    <div className="max-h-[70vh] overflow-auto">
                        {listLoading ? (
                            <div className="px-4 py-6 text-sm text-gray-500">加载中...</div>
                        ) : campaigns.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-gray-500">暂无活动</div>
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {campaigns.map((row) => (
                                    <li key={row.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(row.id)}
                                            className={cn(
                                                'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors',
                                                selectedId === row.id && 'bg-blue-50/60 dark:bg-blue-900/20'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{row.name}</p>
                                                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0', statusClassName(row.status))}>
                                                    {statusLabel(row.status)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{placementOptions.find((opt) => opt.value === row.placement_key)?.label || row.placement_key}</p>
                                            {row.archived_at ? <p className="text-[11px] text-amber-600 mt-1">已归档</p> : null}
                                            <p className="text-[11px] text-gray-400 mt-1">更新于 {format(new Date(row.updated_at), 'yyyy-MM-dd HH:mm')}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">{selectedId ? '编辑活动' : '新建活动'}</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (typeof window === 'undefined') return;
                                    const keysToRemove: string[] = [];
                                    for (let i = 0; i < window.localStorage.length; i += 1) {
                                        const key = window.localStorage.key(i);
                                        if (!key) continue;
                                        if (key.startsWith('ops_campaign_display:') || key.startsWith('ops_campaign_seen_once:')) {
                                            keysToRemove.push(key);
                                        }
                                    }
                                    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
                                    alert.success('已重置本浏览器触发状态，可刷新页面重测');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold"
                            >
                                重置触发状态
                            </button>
                            {selectedId ? (
                                <>
                                    <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => runItemAction('duplicate')}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold disabled:opacity-50"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        复制
                                    </button>
                                    <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => runItemAction('offline')}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold disabled:opacity-50"
                                    >
                                        <PauseCircle className="w-3.5 h-3.5" />
                                        下线
                                    </button>
                                    {!selectedCampaign?.archived_at ? (
                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => runItemAction('archive')}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-semibold disabled:opacity-50"
                                        >
                                            <Archive className="w-3.5 h-3.5" />
                                            归档
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => runItemAction('unarchive')}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold disabled:opacity-50"
                                        >
                                            <ArchiveRestore className="w-3.5 h-3.5" />
                                            取消归档
                                        </button>
                                    )}
                                </>
                            ) : null}

                            {!selectedId ? (
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={createCampaign}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4" />
                                    创建
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={updateCampaign}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    保存
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">活动名称</span>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                                placeholder="例：发布涂装送积分"
                            />
                        </label>

                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">运营位</span>
                            <select
                                value={form.placement_key}
                                onChange={(e) => setForm((prev) => ({ ...prev, placement_key: e.target.value as PlacementKey }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            >
                                {placementOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">状态</span>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as CampaignStatus }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            >
                                <option value="draft">草稿</option>
                                <option value="active">进行中</option>
                                <option value="paused">暂停</option>
                                <option value="ended">已结束</option>
                            </select>
                        </label>

                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">流量比例 (%)</span>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={form.traffic_ratio}
                                onChange={(e) => setForm((prev) => ({ ...prev, traffic_ratio: Number(e.target.value || 0) }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </label>

                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">优先级</span>
                            <input
                                type="number"
                                min={-999}
                                max={999}
                                value={form.priority}
                                onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value || 0) }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </label>

                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">频控（每用户/天）</span>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={form.per_user_per_day}
                                onChange={(e) => setForm((prev) => ({ ...prev, per_user_per_day: Number(e.target.value || 1) }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </label>

                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">开始时间</span>
                            <input
                                type="datetime-local"
                                value={form.start_at}
                                onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </label>

                        <label className="space-y-1">
                            <span className="text-sm text-gray-600">结束时间</span>
                            <input
                                type="datetime-local"
                                value={form.end_at}
                                onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4 space-y-3">
                            <h3 className="text-sm font-semibold">人群配置</h3>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">分群（逗号分隔）</span>
                                <input
                                    value={form.audience_segments}
                                    onChange={(e) => setForm((prev) => ({ ...prev, audience_segments: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                    placeholder="all, new_user"
                                />
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.audience_login_required}
                                    onChange={(e) => setForm((prev) => ({ ...prev, audience_login_required: e.target.checked }))}
                                    className="h-4 w-4"
                                />
                                仅登录用户
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">设备</span>
                                <select
                                    value={form.audience_device}
                                    onChange={(e) => setForm((prev) => ({ ...prev, audience_device: e.target.value as CampaignFormState['audience_device'] }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                >
                                    <option value="all">全部</option>
                                    <option value="desktop">桌面端</option>
                                    <option value="mobile">移动端</option>
                                </select>
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">人群扩展 JSON</span>
                                <textarea
                                    rows={4}
                                    value={form.audience_extra_json}
                                    onChange={(e) => setForm((prev) => ({ ...prev, audience_extra_json: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-mono"
                                />
                            </label>
                        </div>

                        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4 space-y-3">
                            <h3 className="text-sm font-semibold">触发配置</h3>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">触发时机</span>
                                <select
                                    value={form.trigger_on}
                                    onChange={(e) => setForm((prev) => ({ ...prev, trigger_on: e.target.value as TriggerOn }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                >
                                    <option value="page_view">页面访问</option>
                                    <option value="after_generate_success">生成成功后</option>
                                    <option value="manual">手动触发</option>
                                </select>
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">延迟秒数</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.trigger_delay_sec}
                                    onChange={(e) => setForm((prev) => ({ ...prev, trigger_delay_sec: Number(e.target.value || 0) }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                />
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.trigger_first_show_only}
                                    onChange={(e) => setForm((prev) => ({ ...prev, trigger_first_show_only: e.target.checked }))}
                                    className="h-4 w-4"
                                />
                                仅首次展示（用户级）
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.trigger_preview_enabled}
                                    onChange={(e) => setForm((prev) => ({ ...prev, trigger_preview_enabled: e.target.checked }))}
                                    className="h-4 w-4"
                                />
                                开启白名单预览
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">预览白名单 viewerKey（逗号分隔）</span>
                                <input
                                    value={form.trigger_preview_whitelist}
                                    onChange={(e) => setForm((prev) => ({ ...prev, trigger_preview_whitelist: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                    placeholder="vk_xxx,vk_yyy"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">触发扩展 JSON</span>
                                <textarea
                                    rows={4}
                                    value={form.trigger_extra_json}
                                    onChange={(e) => setForm((prev) => ({ ...prev, trigger_extra_json: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-mono"
                                />
                            </label>
                        </div>

                        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4 space-y-3">
                            <h3 className="text-sm font-semibold">内容配置</h3>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">标题</span>
                                <input
                                    value={form.content_title}
                                    onChange={(e) => setForm((prev) => ({ ...prev, content_title: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">副标题</span>
                                <input
                                    value={form.content_subtitle}
                                    onChange={(e) => setForm((prev) => ({ ...prev, content_subtitle: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">说明</span>
                                <textarea
                                    rows={3}
                                    value={form.content_description}
                                    onChange={(e) => setForm((prev) => ({ ...prev, content_description: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">要点（每行一条）</span>
                                <textarea
                                    rows={4}
                                    value={form.content_bullets}
                                    onChange={(e) => setForm((prev) => ({ ...prev, content_bullets: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">CTA 文案</span>
                                <input
                                    value={form.content_cta_text}
                                    onChange={(e) => setForm((prev) => ({ ...prev, content_cta_text: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">横幅图片 URL</span>
                                <input
                                    value={form.content_image_url}
                                    onChange={(e) => setForm((prev) => ({ ...prev, content_image_url: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                    placeholder="可粘贴 URL，或用下方按钮直接上传"
                                />
                            </label>
                            <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={imageUploading}
                                        onClick={() => imageInputRef.current?.click()}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold disabled:opacity-50"
                                    >
                                        <UploadCloud className="w-3.5 h-3.5" />
                                        {imageUploading ? '上传中...' : '上传活动图片'}
                                    </button>
                                    <span className="text-[11px] text-gray-500">支持 PNG/JPG/WEBP，文件 ≤ 2MB</span>
                                </div>
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            void handleImageUpload(file);
                                        }
                                    }}
                                />
                                <div className="text-[11px] text-gray-500 leading-5">
                                    <p>推荐规格：</p>
                                    <p>home_modal：1176 × 202（约 5.8:1）</p>
                                    <p>home_banner：2400 × 480（约 5:1）</p>
                                    <p>wrap_list_slot：1200 × 900（4:3）</p>
                                </div>
                                {form.content_image_url ? (
                                    <div className="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden bg-gray-50">
                                        <img
                                            src={form.content_image_url}
                                            alt="活动图片预览"
                                            className="w-full h-28 object-cover"
                                        />
                                    </div>
                                ) : null}
                            </div>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">内容扩展 JSON</span>
                                <textarea
                                    rows={4}
                                    value={form.content_extra_json}
                                    onChange={(e) => setForm((prev) => ({ ...prev, content_extra_json: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-mono"
                                />
                            </label>
                        </div>

                        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-4 space-y-3">
                            <h3 className="text-sm font-semibold">动作配置</h3>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">动作类型</span>
                                <select
                                    value={form.action_type}
                                    onChange={(e) => setForm((prev) => ({ ...prev, action_type: e.target.value as ActionType }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                >
                                    <option value="none">无动作</option>
                                    <option value="internal_link">站内跳转</option>
                                    <option value="external_link">外链跳转</option>
                                </select>
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">目标地址</span>
                                <input
                                    value={form.action_target}
                                    onChange={(e) => setForm((prev) => ({ ...prev, action_target: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm"
                                    placeholder="/ai-generate/generate 或 https://..."
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-gray-500">动作扩展 JSON</span>
                                <textarea
                                    rows={4}
                                    value={form.action_extra_json}
                                    onChange={(e) => setForm((prev) => ({ ...prev, action_extra_json: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-mono"
                                />
                            </label>
                        </div>
                    </div>

                    <PreviewPanel form={form} />
                </div>
            </div>
        </div>
    );
}
