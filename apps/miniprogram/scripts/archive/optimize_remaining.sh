#!/bin/bash

# 优化剩余模型

MODELS=("Model 3 2024+" "Model Y 2025+")

for MODEL in "${MODELS[@]}"; do
    INPUT="uploads/catalog/$MODEL/model.glb"
    BACKUP="uploads/catalog/$MODEL/model-backup.glb"
    TEMP="uploads/catalog/$MODEL/model-temp.glb"
    
    if [ ! -f "$INPUT" ]; then
        echo "⚠️  跳过 $MODEL (文件不存在)"
        continue
    fi
    
    echo "📦 处理: $MODEL"
    cp "$INPUT" "$BACKUP"
    echo "   ✅ 已备份"
    
    ORIGINAL_SIZE=$(du -h "$INPUT" | cut -f1)
    echo "   📊 原始: $ORIGINAL_SIZE"
    
    gltf-transform prune "$INPUT" "$TEMP" 2>/dev/null
    gltf-transform optimize "$TEMP" "$INPUT" \
        --compress=draco \
        --texture-compress=webp \
        2>/dev/null
    
    rm -f "$TEMP"
    
    NEW_SIZE=$(du -h "$INPUT" | cut -f1)
    echo "   ✅ 完成: $NEW_SIZE"
    echo ""
done

echo "🎉 完成！"
