'use client'

import { useTransition, useState, useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
    const locale = useLocale()
    const pathname = usePathname()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'zh', label: '中文' }
    ]

    const handleSwitch = (newLocale: string) => {
        if (newLocale === locale) {
            setIsOpen(false)
            return
        }

        startTransition(() => {
            router.replace(pathname, { locale: newLocale as 'zh' | 'en' })
        })
        setIsOpen(false)
    }

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isPending}
                className="inline-flex items-center justify-center p-2 text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Select Language"
            >
                {isPending ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 dark:border-zinc-600 dark:border-t-zinc-400 rounded-full animate-spin"></div>
                ) : (
                    <Globe size={20} />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-50">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleSwitch(lang.code)}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${locale === lang.code
                                ? 'bg-gray-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-gray-700 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
