#!/bin/bash

echo "修复 getTranslations API 调用..."

# 修复所有使用旧 API 的文件
for file in \
  src/app/models/\[slug\]/page.tsx \
  src/app/pricing/page.tsx \
  src/app/privacy/page.tsx \
  src/app/refund/page.tsx \
  src/app/terms/page.tsx
do
  if [ -f "$file" ]; then
    echo "  修复: $file"
    # 替换 getTranslations({ locale, namespace: 'XXX' }) 为 getTranslations('XXX')
    sed -i '' -E "s/getTranslations\(\{ locale, namespace: '([^']+)' \}\)/getTranslations('\1')/g" "$file"
    sed -i '' -E "s/getTranslations\(\{locale, namespace: '([^']+)'\}\)/getTranslations('\1')/g" "$file"
  fi
done

echo "完成!"
