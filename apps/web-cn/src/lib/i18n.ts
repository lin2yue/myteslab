import messages from '@/messages/zh.json'

type Messages = typeof messages

// 递归类型用于获取嵌套对象的所有可能的键路径
type NestedKeyOf<T> = T extends object
    ? {
        [K in keyof T]: K extends string
        ? T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}` | K
        : K
        : never
    }[keyof T]
    : never

export type TranslationKey = NestedKeyOf<Messages>

/**
 * 获取翻译文本
 * @param key 翻译键,支持点号分隔的嵌套路径,如 'Common.loading'
 * @returns 翻译后的文本,如果找不到则返回键本身
 */
export function t(key: TranslationKey): string {
    const keys = key.split('.')
    let value: any = messages

    for (const k of keys) {
        value = value?.[k]
        if (value === undefined) {
            return key
        }
    }

    return typeof value === 'string' ? value : key
}

/**
 * 用于客户端组件的翻译 hook
 * @param namespace 命名空间,如 'Common', 'Index' 等
 * @returns 翻译函数
 */
export function useTranslations(namespace: string) {
    const translate = (key: string, params?: Record<string, any>) => {
        const fullKey = `${namespace}.${key}` as TranslationKey
        let text = t(fullKey)

        // 简单的参数替换
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                text = text.replace(new RegExp(`{${key}}`, 'g'), String(value))
            })
        }

        return text
    }

    // 添加 raw 方法用于获取原始值(如数组)
    translate.raw = (key: string) => {
        const fullKey = `${namespace}.${key}` as TranslationKey
        const keys = fullKey.split('.')
        let value: any = messages

        for (const k of keys) {
            value = value?.[k]
            if (value === undefined) {
                return fullKey
            }
        }

        return value
    }

    return translate
}

/**
 * 用于服务端组件的翻译函数
 * @param namespace 命名空间,如 'Common', 'Index' 等
 * @returns 翻译函数
 */
export async function getTranslations(namespace: string) {
    return (key: string, params?: Record<string, any>) => {
        const fullKey = `${namespace}.${key}` as TranslationKey
        let text = t(fullKey)

        // 简单的参数替换
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                text = text.replace(new RegExp(`{${key}}`, 'g'), String(value))
            })
        }

        return text
    }
}

/**
 * 获取当前语言环境
 * @returns 固定返回 'zh'
 */
export function useLocale() {
    return 'zh'
}
