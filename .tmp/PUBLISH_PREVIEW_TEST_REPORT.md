# 发布预览图片测试报告

测试日期: 2026-02-28
测试页面: http://localhost:3000/ai-generate/generate

## 测试目标

测试 AI 生成页面的发布("发布")功能,特别是检查发布预览模态框中的图片是否显示**完整的** 3D 汽车模型,还是只显示**部分/裁剪**的图像。

## 测试执行情况

### ✓ 任务 1: 3D 模型加载验证

**结果: 成功**

- Model Viewer 元素存在: ✓
- Model Viewer 可见: ✓
- 3D 模型(Cybertruck)正确显示: ✓
- 截图证据: `report-task1-model.png`

![3D模型加载成功](report-task1-model.png)

**结论:** 3D 模型查看器工作正常,Cybertruck 模型正确加载并显示。

### ✗ 任务 2: 发布预览图片测试

**结果: 无法完成实际测试**

**原因:**
- 没有已生成的 AI 设计
- 右侧历史面板显示"还没有生成记录"
- "发布分享"按钮被禁用

**发布功能的前置条件:**
1. 用户已登录 ✓
2. 有一个已生成/保存的设计 (activeWrapId) ✗
3. 有当前贴图纹理 (currentTexture) ✗

## 代码分析

虽然无法进行实际的端到端测试,但我对发布预览的代码进行了详细分析:

### PublishModal 组件 (`src/components/publish/PublishModal.tsx`)

#### 预览视图配置 (第 54-62 行)
```typescript
const previewParams = {
    cameraOrbit: "225deg 75deg 85%",  // 方位角 225°, 仰角 75°, 距离 85%
    fieldOfView: "30deg",              // 视野角度 30°
    backgroundColor: "#FFFFFF",
    exposure: 1.0,
    environmentImage: "neutral",
    shadowIntensity: 1,
    shadowSoftness: 1
}
```

#### 截图生成流程 (第 81-84 行)
```typescript
const imageBase64 = await viewerRef.current.takeHighResScreenshot({
    useStandardView: true,    // 使用标准视角
    preserveAspect: true      // 保持宽高比 ✓
})
```

### ModelViewer 截图机制 (`src/components/ModelViewer.tsx`)

#### 关键实现细节:

1. **Canvas 尺寸** (第 146-147 行)
   ```typescript
   canvas.width = 1024;
   canvas.height = 768;  // 4:3 宽高比
   ```

2. **preserveAspect=true 的处理** (第 158-168 行)
   ```typescript
   const scale = Math.min(canvas.width / srcW, canvas.height / srcH);
   const drawW = Math.round(srcW * scale);
   const drawH = Math.round(srcH * scale);
   const offsetX = Math.round((canvas.width - drawW) / 2);
   const offsetY = Math.round((canvas.height - drawH) / 2);
   ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
   ```
   
   **说明:** 图片会被等比例缩放以适应 canvas,保持原始宽高比,居中显示,**不会拉伸变形**。

3. **相机重置** (第 104 行)
   ```typescript
   viewer.setAttribute('camera-target', 'auto auto auto'); // CRITICAL: Reset Pan
   ```
   
   这确保相机对准模型中心。

## 潜在问题分析

虽然代码实现合理,但如果实际使用中发现"预览图只显示部分模型",可能的原因包括:

### 问题 1: Field of View (FOV) 过小
- **当前值:** 30deg
- **影响:** FOV 越小,镜头放大效果越明显,可能导致模型的一部分超出画面
- **建议:** 增加到 35-40deg

### 问题 2: Camera Distance 不够远
- **当前值:** 85% (在 cameraOrbit 参数中)
- **影响:** 如果距离太近,大型车辆(如 Cybertruck)可能无法完全显示
- **建议:** 增加到 95-105%

### 问题 3: 特定车型的配置不当
- **影响:** 不同车型尺寸不同,统一的相机配置可能不适合所有车型
- **建议:** 在 `viewer-config.json` 中为每个车型单独配置 cameraOrbit

### 问题 4: Canvas 尺寸比例问题
- **当前:** 1024x768 (4:3)
- **Model Viewer 实际显示:** 809x549 (约 1.47:1)
- **影响:** 如果 model-viewer 的实际渲染比例与 canvas 不匹配,可能导致裁剪
- **建议:** 使用更宽的 canvas (如 1200x800 或 16:9 比例)

## 推荐的修复方案

如果确实存在"模型显示不完整"的问题,按以下优先级尝试:

### 方案 1: 调整 PublishModal 的预览参数 (优先)

修改 `apps/web-cn/src/components/publish/PublishModal.tsx` 第 54-62 行:

```typescript
const previewParams = {
    cameraOrbit: "225deg 75deg 100%",  // 增加距离 85% → 100%
    fieldOfView: "35deg",               // 增加 FOV 30deg → 35deg
    backgroundColor: "#FFFFFF",
    exposure: 1.0,
    environmentImage: "neutral",
    shadowIntensity: 1,
    shadowSoftness: 1
}
```

### 方案 2: 调整 Canvas 尺寸

修改 `apps/web-cn/src/components/ModelViewer.tsx` 第 146-147 行:

```typescript
canvas.width = 1280;   // 增加宽度
canvas.height = 800;   // 16:10 比例,更适合汽车展示
```

### 方案 3: 为每个车型单独配置

在 `viewer-config.json` 中为 Cybertruck 添加特定配置:

```json
{
  "models": {
    "cybertruck": {
      "cameraOrbit": "225deg 75deg 105%",
      "fieldOfView": "38deg"
    }
  }
}
```

## 验证步骤

要完整验证发布预览功能,需要:

1. **登录系统** (如果尚未登录)
2. **生成一个设计:**
   - 选择 AI 创作模式
   - 输入提示词 (如"科技感蓝色")
   - 等待生成完成
3. **点击"发布分享"按钮**
4. **在发布预览模态框中检查:**
   - 左侧的 3D 预览是否显示完整车身
   - 是否包括车头、车身、车尾
   - 是否有部分被裁剪
5. **如果存在裁剪,应用上述修复方案**

## 测试截图

### 初始页面 - 3D 模型已加载
![初始页面](report-task1-model.png)

可以看到:
- ✓ Cybertruck 3D 模型正确显示
- ✓ 右侧面板显示"还没有生成记录"
- ✓ "发布分享"按钮存在但被禁用

## 总结

### 完成情况
- ✓ **任务 1 完成:** 验证 3D 模型加载正常
- ✗ **任务 2 未完成:** 由于缺少已生成的设计,无法测试发布预览

### 代码质量评估
- ✓ 预览截图机制设计合理
- ✓ `preserveAspect=true` 确保不会变形
- ✓ 相机重置逻辑完善
- ⚠️ FOV 和距离参数可能需要调整

### 建议
1. 如果用户反馈预览图显示不完整,优先尝试**方案 1**(调整 cameraOrbit 和 FOV)
2. 为不同车型配置独立的预览参数
3. 考虑增加"预览图完整性检测"机制,确保生成的截图包含完整模型

---

**注意:** 由于无法实际触发发布流程,本报告基于代码分析和静态页面验证。建议在有真实设计数据的情况下进行完整的端到端测试。
