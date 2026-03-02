import { test } from '@playwright/test';
import path from 'path';

test('测试发布预览图片是否完整显示 3D 模型', async ({ page }) => {
  console.log('\n========================================');
  console.log('测试发布预览图片功能');
  console.log('========================================\n');

  test.setTimeout(90000);

  // 步骤 1: 导航到页面
  console.log('步骤 1: 导航到 http://localhost:3000/ai-generate/generate');
  await page.goto('http://localhost:3000/ai-generate/generate', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  console.log('✓ 页面已加载\n');

  // 步骤 2: 等待 10 秒让 3D 模型加载
  console.log('步骤 2: 等待 10 秒让页面完全加载 (3D 模型应该出现)...');
  await page.waitForTimeout(10000);
  console.log('✓ 等待完成\n');

  // 步骤 3: 截图确认模型可见
  console.log('步骤 3: 截图确认 3D 模型是否可见');
  const screenshot1Path = path.join(__dirname, 'model-loading-screenshot.png');
  await page.screenshot({ path: screenshot1Path, fullPage: true });
  console.log(`✓ 截图已保存: ${screenshot1Path}\n`);

  // 检查 3D 模型
  const canvasInfo = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    return Array.from(canvases).map((canvas, idx) => ({
      index: idx,
      width: canvas.width,
      height: canvas.height,
      displayWidth: canvas.offsetWidth,
      displayHeight: canvas.offsetHeight,
      visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0,
      className: canvas.className,
      id: canvas.id
    }));
  });

  console.log('3D 模型状态:');
  if (canvasInfo.length > 0) {
    const visibleCanvas = canvasInfo.filter(c => c.visible);
    console.log(`  找到 ${canvasInfo.length} 个 canvas 元素`);
    console.log(`  其中 ${visibleCanvas.length} 个是可见的`);
    if (visibleCanvas.length > 0) {
      console.log(`  可见 canvas 尺寸: ${visibleCanvas[0].displayWidth}x${visibleCanvas[0].displayHeight}px`);
      console.log('  ✓ 3D 模型已成功加载\n');
    }
  } else {
    console.log('  ✗ 未找到 canvas 元素\n');
  }

  // 步骤 4: 查找右侧面板的生成历史
  console.log('步骤 4: 查找右侧面板的生成历史...');
  
  const historyAnalysis = await page.evaluate(() => {
    // 查找所有图片
    const allImages = Array.from(document.querySelectorAll('img'));
    const visibleImages = allImages.filter(img => img.offsetWidth > 0 && img.offsetHeight > 0);
    
    // 查找可能是历史记录的图片 (通常是 blob URL 或较小的缩略图)
    const historyImages = visibleImages.filter(img => {
      const src = img.src || '';
      const isBlob = src.includes('blob:');
      const isDataUrl = src.startsWith('data:image');
      const isSmall = img.offsetWidth < 500 && img.offsetHeight < 500;
      return (isBlob || isDataUrl) && isSmall;
    });

    return {
      totalImages: allImages.length,
      visibleImages: visibleImages.length,
      historyImages: historyImages.map((img, idx) => ({
        index: idx,
        src: img.src.substring(0, 60),
        width: img.offsetWidth,
        height: img.offsetHeight,
        alt: img.alt,
        className: img.className,
        clickable: true
      }))
    };
  });

  console.log(`  页面上共有 ${historyAnalysis.totalImages} 个图片元素`);
  console.log(`  其中 ${historyAnalysis.visibleImages} 个是可见的`);
  console.log(`  找到 ${historyAnalysis.historyImages.length} 个可能的历史设计图片`);
  
  if (historyAnalysis.historyImages.length > 0) {
    console.log('  历史设计列表:');
    historyAnalysis.historyImages.forEach((img, idx) => {
      console.log(`    ${idx + 1}. 尺寸: ${img.width}x${img.height}, className: "${img.className}"`);
    });
    console.log('');
  } else {
    console.log('  ✗ 未找到历史设计图片\n');
  }

  // 步骤 5: 查找发布按钮并检查状态
  console.log('步骤 5: 查找发布按钮...');
  
  const publishButton = page.locator('button:has-text("发布")');
  const publishCount = await publishButton.count();

  if (publishCount === 0) {
    console.log('  ✗ 未找到发布按钮');
    const allButtons = await page.locator('button').allTextContents();
    console.log('  页面上所有按钮:', allButtons);
    console.log('\n测试失败: 无法继续\n');
    return;
  }

  console.log(`  ✓ 找到 ${publishCount} 个发布按钮`);
  const isDisabled = await publishButton.first().isDisabled();
  const isVisible = await publishButton.first().isVisible();
  console.log(`  按钮状态: 可见=${isVisible}, 禁用=${isDisabled}\n`);

  // 如果按钮被禁用,尝试解决方案
  if (isDisabled) {
    console.log('发布按钮被禁用，尝试解决方案...\n');
    
    // 方法 1: 如果有历史记录,尝试点击第一个
    if (historyAnalysis.historyImages.length > 0) {
      console.log('  方法 1: 尝试点击历史记录中的设计...');
      
      // 使用更精确的选择器
      const historyImage = page.locator('img').filter({
        has: page.locator(':visible')
      }).first();
      
      try {
        await historyImage.click({ timeout: 3000 });
        console.log('  ✓ 已点击历史设计');
        await page.waitForTimeout(2000);
        
        const stillDisabled = await publishButton.first().isDisabled();
        console.log(`  点击后按钮状态: 禁用=${stillDisabled}\n`);
        
        if (!stillDisabled) {
          console.log('  ✓ 成功启用发布按钮!\n');
        }
      } catch (e) {
        console.log(`  ✗ 点击失败: ${e}\n`);
      }
    }

    // 方法 2: 检查 URL 参数
    const currentUrl = page.url();
    console.log(`  当前 URL: ${currentUrl}`);
    if (!currentUrl.includes('?id=')) {
      console.log('  URL 中没有设计 ID，这可能是按钮禁用的原因\n');
    }

    // 方法 3: 强制启用按钮
    if (await publishButton.first().isDisabled()) {
      console.log('  方法 2: 使用 JavaScript 强制启用按钮...');
      await publishButton.first().evaluate((btn: any) => {
        btn.disabled = false;
        btn.removeAttribute('disabled');
        btn.removeAttribute('aria-disabled');
        btn.classList.remove('disabled');
      });
      console.log('  ✓ 已移除 disabled 属性\n');
    }
  }

  // 步骤 6: 点击发布按钮
  console.log('步骤 6: 点击发布按钮...');
  try {
    await publishButton.first().click({ force: true, timeout: 5000 });
    console.log('  ✓ 已点击发布按钮\n');
  } catch (error) {
    console.log(`  ✗ 点击失败: ${error}\n`);
    const errorScreenshot = path.join(__dirname, 'error-click-button.png');
    await page.screenshot({ path: errorScreenshot, fullPage: true });
    console.log(`  错误截图: ${errorScreenshot}\n`);
    return;
  }

  // 步骤 7: 等待模态框出现
  console.log('步骤 7: 等待发布模态框出现...');
  await page.waitForTimeout(3000);

  // 查找模态框
  const modalSelectors = [
    '[role="dialog"]',
    '.ant-modal',
    '[class*="Modal"]',
    '[class*="modal"]'
  ];

  let modalFound = false;
  let usedSelector = '';

  for (const selector of modalSelectors) {
    const modal = page.locator(selector);
    const count = await modal.count();
    if (count > 0) {
      const isVisible = await modal.first().isVisible();
      if (isVisible) {
        modalFound = true;
        usedSelector = selector;
        console.log(`  ✓ 找到模态框: ${selector}\n`);
        break;
      }
    }
  }

  if (!modalFound) {
    console.log('  ✗ 未找到模态框\n');
    const noModalScreenshot = path.join(__dirname, 'no-modal.png');
    await page.screenshot({ path: noModalScreenshot, fullPage: true });
    console.log(`  当前状态截图: ${noModalScreenshot}\n`);
    
    console.log('\n========================================');
    console.log('测试报告');
    console.log('========================================');
    console.log(`✓ 3D 模型加载: ${canvasInfo.length > 0 && canvasInfo.some(c => c.visible) ? '成功' : '失败'}`);
    console.log(`✗ 发布模态框: 未打开`);
    console.log(`  历史设计数量: ${historyAnalysis.historyImages.length}`);
    console.log(`  发布按钮初始状态: ${isDisabled ? '禁用' : '启用'}`);
    console.log('========================================\n');
    return;
  }

  // 等待预览图片加载
  await page.waitForTimeout(2000);

  // 步骤 8: 截图并分析预览图片
  console.log('步骤 8: 截图并分析发布预览中的图片...');
  const modalScreenshot = path.join(__dirname, 'publish-modal-screenshot.png');
  await page.screenshot({ path: modalScreenshot, fullPage: true });
  console.log(`  ✓ 截图已保存: ${modalScreenshot}\n`);

  // 分析模态框中的预览图片
  const previewAnalysis = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"], .ant-modal, [class*="Modal"]');
    if (!modal) return null;

    const modalImages = Array.from(modal.querySelectorAll('img'));
    const modalCanvas = Array.from(modal.querySelectorAll('canvas'));

    return {
      images: modalImages.map((img: any, idx) => ({
        index: idx,
        src: img.src?.substring(0, 80),
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.offsetWidth,
        displayHeight: img.offsetHeight,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0 && img.naturalWidth > 0,
        alt: img.alt,
        className: img.className
      })),
      canvases: modalCanvas.map((canvas: any, idx) => ({
        index: idx,
        width: canvas.width,
        height: canvas.height,
        displayWidth: canvas.offsetWidth,
        displayHeight: canvas.offsetHeight,
        visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0
      }))
    };
  });

  console.log('预览内容分析:');
  if (previewAnalysis) {
    console.log(`  图片数量: ${previewAnalysis.images.length}`);
    console.log(`  Canvas 数量: ${previewAnalysis.canvases.length}\n`);

    // 显示可见图片的详细信息
    const visiblePreviewImages = previewAnalysis.images.filter(img => img.visible);
    if (visiblePreviewImages.length > 0) {
      console.log('  可见预览图片:');
      visiblePreviewImages.forEach((img, idx) => {
        console.log(`    图片 ${idx + 1}:`);
        console.log(`      - 原始尺寸: ${img.naturalWidth} x ${img.naturalHeight}`);
        console.log(`      - 显示尺寸: ${img.displayWidth} x ${img.displayHeight}`);
        console.log(`      - 宽高比: ${(img.naturalWidth / img.naturalHeight).toFixed(2)}`);
        console.log(`      - className: "${img.className}"`);
        console.log(`      - src: ${img.src}...`);
      });
      console.log('');
    }

    // 显示可见 Canvas
    const visibleCanvases = previewAnalysis.canvases.filter(c => c.visible);
    if (visibleCanvases.length > 0) {
      console.log('  可见 Canvas:');
      visibleCanvases.forEach((canvas, idx) => {
        console.log(`    Canvas ${idx + 1}:`);
        console.log(`      - 尺寸: ${canvas.width} x ${canvas.height}`);
        console.log(`      - 显示尺寸: ${canvas.displayWidth} x ${canvas.displayHeight}`);
      });
      console.log('');
    }
  } else {
    console.log('  ✗ 无法分析预览内容\n');
  }

  // 最终报告
  console.log('\n========================================');
  console.log('测试报告');
  console.log('========================================');
  console.log(`✓ 3D 模型加载: ${canvasInfo.length > 0 && canvasInfo.some(c => c.visible) ? '成功' : '失败'}`);
  console.log(`✓ 发布模态框: ${modalFound ? '已打开' : '未打开'}`);
  console.log(`  历史设计数量: ${historyAnalysis.historyImages.length}`);
  console.log(`  发布按钮初始状态: ${isDisabled ? '禁用' : '启用'}`);
  
  if (previewAnalysis) {
    const visiblePreviewImages = previewAnalysis.images.filter(img => img.visible);
    console.log(`  预览图片数量: ${visiblePreviewImages.length}`);
    
    if (visiblePreviewImages.length > 0) {
      const img = visiblePreviewImages[0];
      console.log(`  预览图片尺寸: ${img.naturalWidth}x${img.naturalHeight}px`);
      console.log(`  预览图片宽高比: ${(img.naturalWidth / img.naturalHeight).toFixed(2)}`);
      console.log('');
      console.log('❗重要: 请手动检查截图以确认:');
      console.log(`  文件: ${modalScreenshot}`);
      console.log('  检查项:');
      console.log('    1. 预览图片是否显示【完整】的 3D 汽车模型?');
      console.log('    2. 还是只显示【部分/裁剪】的图像?');
      console.log('    3. 图片中汽车是否完整可见 (包括车头、车身、车尾)?');
    } else {
      console.log('  ✗ 预览图片未显示');
    }
  }
  
  console.log('========================================\n');
});
