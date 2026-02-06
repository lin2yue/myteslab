#!/bin/bash

# 批量替换 next-intl 导入为自定义 i18n 工具

echo "开始批量更新组件..."

# 查找所有使用 next-intl 的文件
files=$(grep -rl "from 'next-intl'" src/ --include="*.tsx" --include="*.ts" 2>/dev/null || true)

if [ -z "$files" ]; then
    echo "没有找到需要更新的文件"
    exit 0
fi

count=0
for file in $files; do
    # 跳过 i18n 目录的文件(稍后会删除)
    if [[ "$file" == *"/i18n/"* ]]; then
        continue
    fi
    
    echo "更新文件: $file"
    
    # 替换 useTranslations 导入
    sed -i '' "s/import { useTranslations } from 'next-intl'/import { useTranslations } from '@\/lib\/i18n'/g" "$file"
    
    # 替换 getTranslations 导入
    sed -i '' "s/import { getTranslations } from 'next-intl\/server'/import { getTranslations } from '@\/lib\/i18n'/g" "$file"
    
    # 替换 useLocale 导入
    sed -i '' "s/import { useLocale } from 'next-intl'/import { useLocale } from '@\/lib\/i18n'/g" "$file"
    
    # 替换混合导入 (useTranslations, useLocale)
    sed -i '' "s/import { useTranslations, useLocale } from 'next-intl'/import { useTranslations, useLocale } from '@\/lib\/i18n'/g" "$file"
    sed -i '' "s/import { useLocale, useTranslations } from 'next-intl'/import { useTranslations, useLocale } from '@\/lib\/i18n'/g" "$file"
    
    # 替换 NextIntlClientProvider (应该已经在 layout 中移除了)
    sed -i '' "s/import { NextIntlClientProvider } from 'next-intl'/\/\/ NextIntlClientProvider removed/g" "$file"
    sed -i '' "s/import { getMessages } from 'next-intl\/server'/\/\/ getMessages removed/g" "$file"
    
    count=$((count + 1))
done

echo "完成! 共更新了 $count 个文件"
