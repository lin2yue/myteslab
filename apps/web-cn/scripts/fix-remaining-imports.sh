#!/bin/bash

echo "修复剩余的 next-intl 引用..."

# 1. 修复 next-intl/server 引用
echo "1. 修复 next-intl/server 引用..."
for file in \
  src/app/faq/page.tsx \
  src/app/models/\[slug\]/page.tsx \
  src/app/wraps/\[slug\]/page.tsx \
  src/app/profile/page.tsx \
  src/app/pricing/page.tsx \
  src/app/not-found.tsx \
  src/components/RelatedWraps.tsx
do
  if [ -f "$file" ]; then
    echo "  修复: $file"
    sed -i '' "s/from 'next-intl\/server'/from '@\/lib\/i18n'/g" "$file"
  fi
done

# 2. 修复 @/i18n/routing 引用 - 替换为 next/link
echo "2. 修复 @/i18n/routing 引用..."
for file in \
  src/app/faq/page.tsx \
  src/app/wraps/\[slug\]/page.tsx \
  src/app/checkout/success/page.tsx \
  src/app/ai-generate/generate/AIGeneratorMain.tsx \
  src/app/ai-generate/generate/page.tsx \
  src/app/profile/ProfileContent.tsx \
  src/app/profile/page.tsx \
  src/app/not-found.tsx \
  src/components/WrapCard.tsx \
  src/components/RelatedWraps.tsx \
  src/components/DownloadButton.tsx \
  src/components/auth/AuthButton.tsx \
  src/components/layout/Navbar.tsx \
  src/components/layout/Footer.tsx \
  src/components/FilterBar.tsx
do
  if [ -f "$file" ]; then
    echo "  修复: $file"
    # 替换 Link 导入
    sed -i '' "s/import { Link } from '@\/i18n\/routing'/import Link from 'next\/link'/g" "$file"
    sed -i '' "s/import { Link, usePathname } from '@\/i18n\/routing'/import Link from 'next\/link'\nimport { usePathname } from 'next\/navigation'/g" "$file"
    # 替换其他混合导入
    sed -i '' "s/, Link//g" "$file" 2>/dev/null || true
  fi
done

echo "3. 检查 messages 目录..."
if [ ! -d "src/messages" ]; then
  echo "  创建 src/messages 目录..."
  mkdir -p src/messages
fi

if [ -f "messages/zh.json" ] && [ ! -f "src/messages/zh.json" ]; then
  echo "  复制 messages/zh.json 到 src/messages/..."
  cp messages/zh.json src/messages/zh.json
fi

echo "完成!"
