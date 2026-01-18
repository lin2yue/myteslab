#!/bin/bash

# 从 Tesla Wrap Gallery 下载官方 3D 模型

BASE_URL="https://teslawrapgallery.com/tesla_3d_models"
OUTPUT_DIR="uploads/catalog-official"

echo "🚗 从 Tesla Wrap Gallery 下载官方模型..."
echo ""

mkdir -p "$OUTPUT_DIR"

# Cybertruck
echo "📦 Cybertruck"
mkdir -p "$OUTPUT_DIR/Cybertruck"
curl -L "$BASE_URL/Cybertruck.gltf" -o "$OUTPUT_DIR/Cybertruck/model.gltf"
curl -L "$BASE_URL/Cybertruck0.bin" -o "$OUTPUT_DIR/Cybertruck/Cybertruck0.bin"
echo "   ✅ 完成"

# Model 3 (旧版)
echo "📦 Model 3"
mkdir -p "$OUTPUT_DIR/Model 3"
curl -L "$BASE_URL/Model3_High.gltf" -o "$OUTPUT_DIR/Model 3/model.gltf"
curl -L "$BASE_URL/Model3_High0.bin" -o "$OUTPUT_DIR/Model 3/Model3_High0.bin"
echo "   ✅ 完成"

# Model 3 2024+
echo "📦 Model 3 2024+"
mkdir -p "$OUTPUT_DIR/Model 3 2024+"
curl -L "$BASE_URL/Poppyseed.gltf" -o "$OUTPUT_DIR/Model 3 2024+/model.gltf"
curl -L "$BASE_URL/Poppyseed0.bin" -o "$OUTPUT_DIR/Model 3 2024+/Poppyseed0.bin"
echo "   ✅ 完成"

# Model Y (旧版)
echo "📦 Model Y"
mkdir -p "$OUTPUT_DIR/Model Y"
curl -L "$BASE_URL/ModelY_High.gltf" -o "$OUTPUT_DIR/Model Y/model.gltf"
curl -L "$BASE_URL/ModelY_High0.bin" -o "$OUTPUT_DIR/Model Y/ModelY_High0.bin"
echo "   ✅ 完成"

# Model Y 2025+ Premium
echo "📦 Model Y 2025+ (Premium)"
mkdir -p "$OUTPUT_DIR/Model Y 2025+"
curl -L "$BASE_URL/Bayberry.gltf" -o "$OUTPUT_DIR/Model Y 2025+/model.gltf"
curl -L "$BASE_URL/Bayberry0.bin" -o "$OUTPUT_DIR/Model Y 2025+/Bayberry0.bin"
echo "   ✅ 完成"

echo ""
echo "📊 下载结果:"
du -h "$OUTPUT_DIR"/*/model.gltf

echo ""
echo "💡 下一步:"
echo "   1. 转换 GLTF 为 GLB (可选)"
echo "   2. 测试模型质量"
echo "   3. 如果满意，替换 uploads/catalog/ 中的旧模型"
