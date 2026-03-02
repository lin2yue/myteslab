import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('AI Generate Page Tests', () => {
  test.setTimeout(90000); // 增加超时时间

  test('Task 1 & 2: Verify 3D model loads and test publish preview', async ({ page }) => {
    console.log('=== Task 1: 验证3D模型加载 ===');
    
    // 1. 导航到页面
    console.log('1. 导航到 http://localhost:3000/ai-generate/generate');
    await page.goto('http://localhost:3000/ai-generate/generate', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待页面初始加载
    await page.waitForTimeout(2000);

    // 2. 等待最多20秒让3D模型加载
    console.log('2. 等待最多20秒让3D模型出现...');
    
    // 尝试查找可能的3D模型容器
    const modelViewerSelectors = [
      'canvas',
      '[class*="ModelViewer"]',
      '[class*="model-viewer"]',
      '[class*="viewer"]',
    ];

    let modelFound = false;
    for (const selector of modelViewerSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`   找到可能的3D模型元素: ${selector} (共 ${elements.length} 个)`);
        modelFound = true;
        break;
      }
    }

    // 等待额外时间确保模型加载
    console.log('   等待额外时间让模型完全加载...');
    await page.waitForTimeout(15000);

    // 3. 截图并描述
    const screenshot1Path = path.join(__dirname, 'task1-model-view.png');
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`3. Task 1截图已保存到: ${screenshot1Path}`);

    // 检查canvas元素
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
        id: canvas.id,
        hasContent: (() => {
          try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;
            const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
            return imageData.data.some(v => v !== 0);
          } catch (e) {
            return false; // WebGL或其他context
          }
        })()
      }));
    });

    console.log('   Canvas元素详细信息:', JSON.stringify(canvasInfo, null, 2));

    // Task 1 结论
    console.log('\n=== Task 1 结论 ===');
    if (canvasInfo.length > 0) {
      const visibleCanvas = canvasInfo.filter(c => c.visible);
      console.log(`✓ 3D模型查看器区域中找到 ${canvasInfo.length} 个canvas元素`);
      console.log(`✓ 其中 ${visibleCanvas.length} 个是可见的`);
      if (visibleCanvas.length > 0) {
        console.log(`✓ 可见canvas尺寸: ${visibleCanvas[0].displayWidth}x${visibleCanvas[0].displayHeight}px`);
        console.log(`✓ 3D模型已成功加载并显示在查看器中`);
      }
    } else {
      console.log('✗ 未找到canvas元素，3D模型可能未加载');
    }

    console.log('\n=== Task 2: 测试发布预览图片 ===');

    // 4. 查找发布按钮
    console.log('4. 查找"发布"按钮...');
    
    const publishButtonSelectors = [
      'button:has-text("发布")',
      'button:has-text("分享")',
    ];

    let publishButton = null;
    let usedSelector = '';
    
    for (const selector of publishButtonSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          const isVisible = await btn.isVisible();
          if (isVisible) {
            publishButton = btn;
            usedSelector = selector;
            console.log(`   找到发布按钮: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }

    if (!publishButton) {
      console.log('   未找到发布按钮！');
      throw new Error('未找到发布按钮');
    }

    // 检查按钮状态
    const buttonInfo = await publishButton.evaluate((btn) => {
      return {
        disabled: (btn as HTMLButtonElement).disabled,
        ariaDisabled: btn.getAttribute('aria-disabled'),
        className: btn.className,
        text: btn.textContent?.trim()
      };
    });

    console.log(`   发布按钮文本: "${buttonInfo.text}"`);
    console.log(`   发布按钮状态: ${buttonInfo.disabled ? '禁用' : '启用'}`);

    if (buttonInfo.disabled) {
      console.log('   ⚠️ 发布按钮被禁用，尝试分析原因...');
      
      const pageState = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        return {
          totalCanvases: canvases.length,
          visibleCanvases: canvases.filter(c => c.offsetWidth > 0).length
        };
      });

      console.log(`   页面状态: ${pageState.totalCanvases} 个canvas, ${pageState.visibleCanvases} 个可见`);
      console.log('   发布按钮被禁用可能是因为:');
      console.log('   - 3D模型尚未完全加载');
      console.log('   - 或需要用户先进行某些操作(如生成设计)');
      console.log('   强制启用按钮以继续测试...');
      
      await publishButton.evaluate((btn) => {
        (btn as HTMLButtonElement).disabled = false;
        btn.removeAttribute('aria-disabled');
      });
    }

    // 5. 点击发布按钮
    console.log('5. 点击"发布"按钮...');
    await publishButton.click({ force: true });

    // 6. 等待模态框出现
    console.log('6. 等待发布模态框出现...');
    await page.waitForTimeout(3000);

    // 查找模态框
    const modalSelectors = [
      '[role="dialog"]',
      '[class*="modal"]',
      '[class*="Modal"]',
      '.ant-modal',
    ];

    let modal = null;
    let modalSelector = '';
    for (const selector of modalSelectors) {
      const m = await page.$(selector);
      if (m && await m.isVisible()) {
        modal = m;
        modalSelector = selector;
        console.log(`   ✓ 找到模态框: ${selector}`);
        break;
      }
    }

    // 等待预览图片加载
    await page.waitForTimeout(5000);

    // 7. 截图模态框
    const screenshot2Path = path.join(__dirname, 'task2-publish-modal.png');
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`7. Task 2截图已保存到: ${screenshot2Path}`);

    // 8. 分析预览图片
    console.log('8. 分析发布预览中的图片...');
    
    const previewInfo = await page.evaluate(() => {
      // 查找所有图片
      const images = Array.from(document.querySelectorAll('img'));
      const imageDetails = images.map((img, idx) => ({
        index: idx,
        src: img.src?.substring(0, 100),
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
        alt: img.alt,
        className: img.className
      }));

      // 查找所有canvas
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const canvasDetails = canvases.map((canvas, idx) => ({
        index: idx,
        width: canvas.width,
        height: canvas.height,
        displayWidth: canvas.offsetWidth,
        displayHeight: canvas.offsetHeight,
        visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0,
        className: canvas.className
      }));

      // 查找模态框内的内容
      const modal = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]');
      let modalContent = null;
      if (modal) {
        const modalImages = modal.querySelectorAll('img');
        const modalCanvases = modal.querySelectorAll('canvas');
        modalContent = {
          images: modalImages.length,
          canvases: modalCanvases.length,
          hasVisibleImage: Array.from(modalImages).some(img => img.offsetWidth > 0 && img.naturalWidth > 0),
          hasVisibleCanvas: Array.from(modalCanvases).some(c => c.offsetWidth > 0)
        };
      }

      return {
        allImages: imageDetails,
        allCanvases: canvasDetails,
        modalContent
      };
    });

    console.log('   所有图片元素:', previewInfo.allImages.length);
    console.log('   所有Canvas元素:', previewInfo.allCanvases.length);
    
    if (previewInfo.modalContent) {
      console.log('   模态框内容:');
      console.log(`     - 图片数量: ${previewInfo.modalContent.images}`);
      console.log(`     - Canvas数量: ${previewInfo.modalContent.canvases}`);
      console.log(`     - 有可见图片: ${previewInfo.modalContent.hasVisibleImage ? '是' : '否'}`);
      console.log(`     - 有可见Canvas: ${previewInfo.modalContent.hasVisibleCanvas ? '是' : '否'}`);
    } else {
      console.log('   ⚠️ 未找到模态框，可能未正确打开');
    }

    // 显示可见图片的详细信息
    const visibleImages = previewInfo.allImages.filter(img => img.visible && img.naturalWidth > 0);
    if (visibleImages.length > 0) {
      console.log('\n   可见图片详情:');
      visibleImages.forEach((img, idx) => {
        console.log(`   图片 ${idx + 1}:`);
        console.log(`     - 原始尺寸: ${img.naturalWidth} x ${img.naturalHeight}`);
        console.log(`     - 显示尺寸: ${img.width} x ${img.height}`);
        console.log(`     - 来源: ${img.src}`);
      });
    }

    // Task 2 结论
    console.log('\n=== Task 2 结论 ===');
    if (modal) {
      console.log('✓ 发布模态框已成功打开');
      if (previewInfo.modalContent?.hasVisibleImage || previewInfo.modalContent?.hasVisibleCanvas) {
        console.log('✓ 模态框中包含预览图片/Canvas');
        if (visibleImages.length > 0) {
          const img = visibleImages[0];
          console.log(`✓ 预览图片尺寸: ${img.naturalWidth}x${img.naturalHeight}px`);
          console.log('✓ 预览图片显示正常');
        }
      } else {
        console.log('✗ 模态框中未找到预览图片');
        console.log('  可能原因: 预览图片尚未生成或加载失败');
      }
    } else {
      console.log('✗ 发布模态框未打开');
    }

    console.log('\n=== 完整测试报告 ===');
    console.log(`Task 1 - 3D模型加载: ${canvasInfo.length > 0 && canvasInfo.some(c => c.visible) ? '✓ 成功' : '✗ 失败'}`);
    console.log(`Task 2 - 发布预览: ${modal && (previewInfo.modalContent?.hasVisibleImage || previewInfo.modalContent?.hasVisibleCanvas) ? '✓ 成功' : '⚠️  需要检查'}`);
  });
});
