#!/bin/bash

echo "修复 useRouter 和 redirect 引用..."

# 修复 useRouter
echo "1. 修复 useRouter..."
for file in \
  src/app/ai-generate/generate/AIGeneratorMain.tsx \
  src/components/DownloadButton.tsx \
  src/components/FilterBar.tsx
do
  if [ -f "$file" ]; then
    echo "  修复: $file"
    sed -i '' "s/import { useRouter } from '@\/i18n\/routing'/import { useRouter } from 'next\/navigation'/g" "$file"
    sed -i '' "s/import { useRouter, usePathname } from '@\/i18n\/routing'/import { useRouter, usePathname } from 'next\/navigation'/g" "$file"
  fi
done

# 修复 redirect
echo "2. 修复 redirect..."
for file in src/app/profile/page.tsx; do
  if [ -f "$file" ]; then
    echo "  修复: $file"
    sed -i '' "s/import { redirect } from '@\/i18n\/routing'/import { redirect } from 'next\/navigation'/g" "$file"
  fi
done

echo "完成!"
