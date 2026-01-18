#!/bin/bash

# 模型优化脚本
# 功能：压缩、简化、去除未使用的数据

echo "🚀 开始优化模型..."

# 定义要优化的模型
MODELS=("Model 3" "Model Y" "Cybertruck")

for MODEL in "${MODELS[@]}"; do
    INPUT="uploads/catalog/$MODEL/model.glb"
    BACKUP="uploads/catalog/$MODEL/model-backup.glb"
    TEMP="uploads/catalog/$MODEL/model-temp.glb"
    
    if [ ! -f "$INPUT" ]; then
        echo "⚠️  跳过 $MODEL (文件不存在)"
        continue
    fi
    
    echo ""
    echo "📦 处理: $MODEL"
    
    # 备份原文件
    cp "$INPUT" "$BACKUP"
    echo "   ✅ 已备份原文件"
    
    # 获取原始大小
    ORIGINAL_SIZE=$(du -h "$INPUT" | cut -f1)
    echo "   📊 原始大小: $ORIGINAL_SIZE"
    
    # 优化步骤
    echo "   🔧 优化中..."
    
    # 1. 去除未使用的数据
    gltf-transform prune "$INPUT" "$TEMP" 2>/dev/null
    
    # 2. 压缩 (Draco + 纹理压缩)
    gltf-transform optimize "$TEMP" "$INPUT" \
        --compress=draco \
        --texture-compress=webp \
        2>/dev/null
    
    # 清理临时文件
    rm -f "$TEMP"
    
    # 获取优化后大小
    NEW_SIZE=$(du -h "$INPUT" | cut -f1)
    echo "   ✅ 优化完成: $NEW_SIZE"
    echo "   💾 备份位置: $BACKUP"
done

echo ""
echo "🎉 所有模型优化完成！"
echo "💡 提示: 如需恢复原文件，使用 model-backup.glb"
