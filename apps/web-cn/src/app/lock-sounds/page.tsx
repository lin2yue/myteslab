import type { Metadata } from 'next'
import LockSoundsClient from '@/components/audio/LockSoundsClient'

export const revalidate = 60

export const metadata: Metadata = {
    title: '特斯拉锁车音效库 - 试听与下载 | 特玩',
    description: '精选特斯拉锁车音效，支持在线试听与一键下载。热门与最新双排序，快速找到你喜欢的锁车音。',
    alternates: {
        canonical: '/lock-sounds',
    },
    openGraph: {
        title: '特斯拉锁车音效库 - 试听与下载 | 特玩',
        description: '精选特斯拉锁车音效，支持在线试听与一键下载。',
        url: 'https://tewan.club/lock-sounds',
        siteName: '特玩',
        locale: 'zh_CN',
        type: 'website',
    },
}

export default function LockSoundsPage() {
    return <LockSoundsClient />
}
