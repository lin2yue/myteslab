'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface WechatScanProps {
    onSuccess: () => void;
}

export default function WechatScan({ onSuccess }: WechatScanProps) {
    const t = useTranslations('Login');
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [sceneId, setSceneId] = useState<string | null>(null);
    const [status, setStatus] = useState<'LOADING' | 'READY' | 'SCANNED' | 'EXPIRED' | 'ERROR'>('LOADING');
    const [error, setError] = useState<string | null>(null);
    const pollTimer = useRef<NodeJS.Timeout>();

    const fetchTicket = async () => {
        setStatus('LOADING');
        setError(null);
        if (pollTimer.current) clearInterval(pollTimer.current);

        try {
            const res = await fetch('/api/auth/wechat-mp/ticket', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                // Revert to standard WeChat QR (Scheme B: Scan -> Follow -> Click)
                setQrUrl(data.qrUrl);
                setSceneId(data.sceneId);
                setStatus('READY');
            } else {
                setError(data.error || t('error_default'));
                setStatus('ERROR');
            }
        } catch (err) {
            setError(t('error_default'));
            setStatus('ERROR');
        }
    };

    const pollStatus = async (currentSceneId: string) => {
        try {
            const res = await fetch(`/api/auth/wechat-mp/check?sceneId=${currentSceneId}`);
            const data = await res.json();

            if (data.status === 'COMPLETED') {
                setStatus('SCANNED');
                if (pollTimer.current) clearInterval(pollTimer.current);
                setTimeout(() => onSuccess(), 1000);
                return;
            }

            if (data.status === 'EXPIRED') {
                setStatus('EXPIRED');
                if (pollTimer.current) clearInterval(pollTimer.current);
                return;
            }
        } catch (err) {
            console.error('Polling error', err);
        }
    };

    useEffect(() => {
        fetchTicket();
        return () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
        };
    }, []);

    useEffect(() => {
        if (status === 'READY' && sceneId) {
            pollTimer.current = setInterval(() => pollStatus(sceneId), 2000);
        }
    }, [status, sceneId]);

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-900/50 rounded-2xl border border-black/5 dark:border-white/5 shadow-inner">
            <div className="relative w-48 h-48 bg-gray-50 dark:bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center border border-black/5 dark:border-white/10">
                {status === 'LOADING' && (
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                )}

                {(status === 'READY' || status === 'SCANNED') && qrUrl && (
                    <img
                        src={qrUrl}
                        alt="WeChat QR Code"
                        className={`w-full h-full transition-opacity duration-300 ${status === 'SCANNED' ? 'opacity-20 grayscale' : 'opacity-100'}`}
                    />
                )}

                {status === 'SCANNED' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 dark:bg-black/40 backdrop-blur-sm animate-in fade-in zoom-in-95">
                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">{t('wechat_scan_success')}</span>
                    </div>
                )}

                {(status === 'EXPIRED' || status === 'ERROR') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
                        <p className="text-xs text-gray-500 mb-3">{error || t('wechat_scan_expired')}</p>
                        <button
                            onClick={fetchTicket}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {t('wechat_scan_retry')}
                        </button>
                    </div>
                )}
            </div>

            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {t('wechat_scan_tip')}
            </p>
        </div>
    );
}
