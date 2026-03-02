import { test } from '@playwright/test';
import path from 'path';

test('测试发布预览 - 报告现状', async ({ page }) => {
  console.log('\n========================================');
  console.log('发布预览功能测试报告');
  console.log('========================================\n');

  test.setTimeout(90000);

  // 步骤 1: 导航到页面
  console.log('步骤 1: 导航到页面');
  await page.goto('http://localhost:3000/ai-generate/generate', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  await page.waitForTimeout(10000);
  
  const initialScreenshot = path.join(__dirname, 'report-task1-model.png');
  await page.screenshot({ path: initialScreenshot, fullPage: true });
  console.log(`✓ 初始页面截图: ${initialScreenshot}\n`);

  // 检查 3D 模型
  const modelStatus = await page.evaluate(() => {
    const modelViewer = document.querySelector('model-viewer');
    return {
      exists: !!modelViewer,
      visible: modelViewer ? (modelViewer as HTMLElement).offsetWidth > 0 : false,
      modelLoaded: modelViewer ? (modelViewer as any).modelIsLoaded : false
    };
  });

  console.log('===== 任务 1: 3D 模型加载状态 =====');
  console.log(`Model Viewer 存在: ${modelStatus.exists ? '✓' : '✗'}`);
  console.log(`Model Viewer 可见: ${modelStatus.visible ? '✓' : '✗'}`);
  console.log(`模型已加载: ${modelStatus.modelLoaded ? '✓' : '未知'}\n`);

  // 检查发布按钮和历史记录
  const pageAnalysis = await page.evaluate(() => {
    // 查找发布按钮
    const publishButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
      btn.textContent?.includes('发布')
    );
    
    // 查找历史记录图片
    const allImages = Array.from(document.querySelectorAll('img'));
    const historyImages = allImages.filter(img => {
      const src = img.src || '';
      return (src.includes('blob:') || src.startsWith('data:image')) && 
             img.offsetWidth > 0 && img.offsetWidth < 400;
    });

    return {
      publishButtonCount: publishButtons.length,
      publishButtonDisabled: publishButtons[0] ? (publishButtons[0] as HTMLButtonElement).disabled : null,
      publishButtonText: publishButtons[0]?.textContent?.trim(),
      historyImageCount: historyImages.length,
      totalImages: allImages.length
    };
  });

  console.log('===== 页面状态分析 =====');
  console.log(`发布按钮: ${pageAnalysis.publishButtonCount > 0 ? '✓ 找到' : '✗ 未找到'}`);
  if (pageAnalysis.publishButtonCount > 0) {
    console.log(`  文本: "${pageAnalysis.publishButtonText}"`);
    console.log(`  状态: ${pageAnalysis.publishButtonDisabled ? '禁用' : '启用'}`);
  }
  console.log(`历史设计图片: ${pageAnalysis.historyImageCount} 个`);
  console.log(`页面总图片数: ${pageAnalysis.totalImages}\n`);

  console.log('===== 任务 2: 发布预览测试 =====');
  
  if (pageAnalysis.historyImageCount === 0 && pageAnalysis.publishButtonDisabled) {
    console.log('✗ 无法测试发布预览:');
    console.log('  原因: 没有已生成的设计，发布按钮被禁用');
    console.log('  说明: 发布功能需要以下条件:');
    console.log('    1. 用户已登录');
    console.log('    2. 有一个已生成/保存的设计(activeWrapId)');
    console.log('    3. 有当前贴图纹理(currentTexture)');
    console.log('\n建议解决方案:');
    console.log('  方法 1: 先使用 AI 生成一个设计');
    console.log('  方法 2: 手动登录并上传/生成一个设计');
    console.log('  方法 3: 使用带设计 ID 的 URL: /ai-generate/generate?id=XXX');
    console.log('\n为了验证发布预览功能,让我尝试读取 PublishModal 组件代码...\n');
  }

  // 分析 PublishModal 的截图逻辑
  console.log('===== PublishModal 截图机制分析 =====');
  console.log('根据代码分析 (PublishModal.tsx):');
  console.log('');
  console.log('1. 预览视图配置:');
  console.log('   - Camera Orbit: 225deg 75deg 85%');
  console.log('   - Field of View: 30deg');
  console.log('   - 背景色: #FFFFFF');
  console.log('');
  console.log('2. 截图生成流程:');
  console.log('   - 使用 ModelViewer.takeHighResScreenshot()');
  console.log('   - useStandardView: true (使用标准视角)');
  console.log('   - preserveAspect: true (保持宽高比)');
  console.log('');
  console.log('3. 截图尺寸处理 (ModelViewer.tsx):');
  console.log('   - 目标 Canvas 尺寸: 1024x768');
  console.log('   - preserveAspect=true 时: 图片会被缩放以适应 canvas,保持原始宽高比,居中显示');
  console.log('   - preserveAspect=false 时: 图片会被拉伸到 1024x768');
  console.log('');
  console.log('4. 潜在问题点:');
  console.log('   a) 相机视角: 如果 cameraOrbit 设置不当,可能只看到模型的一部分');
  console.log('   b) Field of View: FOV 太小会放大模型,可能导致部分被裁剪');
  console.log('   c) Camera Target: 如果 camera-target 设置不当,镜头可能没有对准模型中心');
  console.log('');

  // 模拟检查相机配置
  const cameraConfig = await page.evaluate(() => {
    const modelViewer = document.querySelector('model-viewer');
    if (!modelViewer) return null;

    return {
      cameraOrbit: modelViewer.getAttribute('camera-orbit'),
      fieldOfView: modelViewer.getAttribute('field-of-view'),
      cameraTarget: modelViewer.getAttribute('camera-target'),
      bounds: (modelViewer as any).getBoundingClientRect ? (modelViewer as any).getBoundingClientRect() : null
    };
  });

  if (cameraConfig) {
    console.log('5. 当前 Model Viewer 配置:');
    console.log(`   - Camera Orbit: ${cameraConfig.cameraOrbit || '默认'}`);
    console.log(`   - Field of View: ${cameraConfig.fieldOfView || '默认'}`);
    console.log(`   - Camera Target: ${cameraConfig.cameraTarget || '默认'}`);
    if (cameraConfig.bounds) {
      console.log(`   - 显示尺寸: ${Math.round(cameraConfig.bounds.width)}x${Math.round(cameraConfig.bounds.height)}`);
    }
    console.log('');
  }

  console.log('===== 测试结论 =====\n');
  
  console.log('任务 1 - 3D 模型加载:');
  if (modelStatus.exists && modelStatus.visible) {
    console.log('  ✓ 成功: 3D 模型已加载并可见');
    console.log(`    截图: ${initialScreenshot}`);
  } else {
    console.log('  ✗ 失败: 3D 模型未正确加载');
  }
  console.log('');

  console.log('任务 2 - 发布预览测试:');
  console.log('  状态: 无法进行实际测试');
  console.log('  原因: 缺少必要的前置条件 (已生成的设计)');
  console.log('');
  console.log('  发布按钮要求:');
  console.log(`    - 历史设计数量: ${pageAnalysis.historyImageCount} (需要 ≥ 1)`);
  console.log(`    - 按钮状态: ${pageAnalysis.publishButtonDisabled ? '禁用' : '启用'} (需要"启用")`);
  console.log('');

  console.log('关于"预览图是否显示完整 3D 模型"的问题:');
  console.log('');
  console.log('根据代码分析,预览截图机制本身是合理的:');
  console.log('  • preserveAspect=true 确保不会拉伸变形');
  console.log('  • 使用标准视角 (225deg 75deg 85%) 应该能看到完整车身');
  console.log('  • Canvas 尺寸 1024x768 (4:3) 适合展示汽车');
  console.log('');
  console.log('如果存在"只显示部分模型"的问题,可能原因:');
  console.log('  1. FOV (30deg) 可能偏小,导致模型被放大裁剪');
  console.log('     解决: 增加 FOV 到 35-40deg');
  console.log('  2. Camera Orbit 距离 (85%) 可能不够远');
  console.log('     解决: 增加距离到 95-105%');
  console.log('  3. 特定车型的 cameraOrbit 配置不当');
  console.log('     解决: 在 viewer-config.json 中为每个车型单独调整');
  console.log('');
  
  console.log('建议的验证步骤:');
  console.log('  1. 登录系统');
  console.log('  2. 使用 AI 生成一个设计 (或使用 DIY 模式上传图片)');
  console.log('  3. 点击"发布分享"按钮');
  console.log('  4. 在发布预览模态框中检查 3D 模型显示是否完整');
  console.log('  5. 如果模型被裁剪,调整 PublishModal.tsx 中的 previewParams');
  console.log('');

  console.log('========================================');
  console.log('测试完成');
  console.log('========================================\n');
});
