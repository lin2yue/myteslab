#!/bin/bash

echo "📦 开始打包模型调试工具..."

# 创建目录结构
mkdir -p model-debug-package/models/{cybertruck,model-3,model-3-2024,model-y,model-y-2025}/textures

# 复制模型文件（使用备份文件，未优化的原始版本）
echo "📁 复制模型文件..."
cp "uploads/catalog/Cybertruck/model-backup.glb" "model-debug-package/models/cybertruck/model.glb" 2>/dev/null || \
   cp "uploads/catalog/Cybertruck/model.glb" "model-debug-package/models/cybertruck/model.glb"

cp "uploads/catalog/Model 3/model-backup.glb" "model-debug-package/models/model-3/model.glb" 2>/dev/null || \
   cp "uploads/catalog/Model 3/model.glb" "model-debug-package/models/model-3/model.glb"

cp "uploads/catalog/Model 3 2024+/model-backup.glb" "model-debug-package/models/model-3-2024/model.glb" 2>/dev/null || \
   cp "uploads/catalog/Model 3 2024+/model.glb" "model-debug-package/models/model-3-2024/model.glb"

cp "uploads/catalog/Model Y/model-backup.glb" "model-debug-package/models/model-y/model.glb" 2>/dev/null || \
   cp "uploads/catalog/Model Y/model.glb" "model-debug-package/models/model-y/model.glb"

cp "uploads/catalog/Model Y 2025+/model-backup.glb" "model-debug-package/models/model-y-2025/model.glb" 2>/dev/null || \
   cp "uploads/catalog/Model Y 2025+/model.glb" "model-debug-package/models/model-y-2025/model.glb"

# 复制贴图文件（每个模型5张）
echo "🎨 复制贴图文件..."
TEXTURES=("Camo" "Vintage_Stripes" "Vintage_Gradient" "Valentine" "Sakura")

for model_dir in "Cybertruck" "Model 3" "Model 3 2024+" "Model Y" "Model Y 2025+"; do
    case "$model_dir" in
        "Cybertruck") target="cybertruck" ;;
        "Model 3") target="model-3" ;;
        "Model 3 2024+") target="model-3-2024" ;;
        "Model Y") target="model-y" ;;
        "Model Y 2025+") target="model-y-2025" ;;
    esac
    
    for texture in "${TEXTURES[@]}"; do
        src="uploads/catalog/$model_dir/wraps/Official/${texture}.png"
        dst="model-debug-package/models/$target/textures/${texture}.png"
        
        if [ -f "$src" ]; then
            cp "$src" "$dst"
            echo "  ✅ $target/$texture.png"
        else
            echo "  ⚠️  未找到: $src"
        fi
    done
done

# 创建 README
cat > model-debug-package/README.md << 'EOF'
# Tesla 车身涂装调试工具

## 📋 使用说明

### 1. 打开工具
直接双击 `index.html` 在浏览器中打开（推荐 Chrome）

### 2. 功能说明
- **模型选择**: 切换不同车型
- **贴图选择**: 切换不同涂装图案
- **Use Unique UVs**: 切换UV映射（修复左右对称问题）
- **检查 UV2 状态**: 查看模型是否有第二套UV
- **贴图调整**: 缩放、旋转、镜像、颜色
- **导出配置**: 保存当前参数为 JSON
- **截图保存**: 导出当前视图

### 3. 模型修复指南

#### 问题1: 黑色机盖/车门
**原因**: 材质没有正确的贴图通道
**修复**: 
1. 在 Blender 中打开模型
2. 选中黑色部件
3. 复制正常部件的材质
4. 或手动添加 Base Color Texture 节点

#### 问题2: UV Swap 无效
**原因**: 模型缺少第二套UV (TEXCOORD_1)
**修复**:
1. 在 Blender 中为所有车身网格添加第二套UV
2. 导出时确保勾选 "UV" 和 "自定义属性"

#### 问题3: 贴图错位/镜像
**原因**: UV 映射不正确
**修复**:
1. 在 Blender 的 UV 编辑器中调整
2. 或使用 "智能UV投影" 重新展开

### 4. 导出设置（Blender）
```
文件 → 导出 → glTF 2.0 (.glb)

✅ 包含 → 自定义属性
✅ 几何数据 → UV
✅ 几何数据 → 法线
✅ 格式 → glTF 二进制 (.glb)
```

### 5. 文件结构
```
model-debug-package/
├── index.html          # 调试工具主页面
├── README.md           # 本说明文件
└── models/
    ├── cybertruck/
    │   ├── model.glb
    │   └── textures/
    │       ├── Camo.png
    │       ├── Vintage_Stripes.png
    │       ├── Vintage_Gradient.png
    │       ├── Valentine.png
    │       └── Sakura.png
    ├── model-3/
    ├── model-3-2024/
    ├── model-y/
    └── model-y-2025/
```

### 6. 修复后替换
修复好的模型直接替换对应的 `model.glb` 文件即可

## ⚠️ 注意事项
- 所有模型文件都是原始备份版本（未优化）
- 修复完成后需要重新优化压缩
- 确保所有车身网格都有完整的UV映射

## 📞 技术支持
如有问题请联系开发团队
EOF

# 创建压缩包
echo ""
echo "🗜️  创建压缩包..."
cd model-debug-package
zip -r ../model-debug-package.zip . -x "*.DS_Store"
cd ..

echo ""
echo "✅ 打包完成！"
echo "📦 文件位置: $(pwd)/model-debug-package.zip"
echo "📁 文件夹: $(pwd)/model-debug-package/"
echo ""
echo "💡 提示:"
echo "   - 可以直接发送 model-debug-package.zip 给模型师"
echo "   - 或者打开 model-debug-package/index.html 本地测试"
