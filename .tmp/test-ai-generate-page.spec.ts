import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('AI Generate Page Tests', () => {
  test.setTimeout(60000); // 增加超时时间以适应3D模型加载

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
      'canvas', // Three.js 通常使用 canvas
      '[class*="ModelViewer"]',
      '[class*="model-viewer"]',
      '[class*="viewer"]',
      '[id*="model"]',
      '[id*="viewer"]',
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
    const screenshot1Path = path.join(__dirname, 'model-loading-screenshot.png');
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`3. 截图已保存到: ${screenshot1Path}`);

    // 分析页面状态
    const pageTitle = await page.title();
    console.log(`   页面标题: ${pageTitle}`);

    // 检查是否有错误信息
    const errorMessages = await page.evaluate(() => {
      const errors: string[] = [];
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
      errorElements.forEach(el => {
        if (el.textContent) errors.push(el.textContent.trim());
      });
      return errors;
    });

    if (errorMessages.length > 0) {
      console.log('   发现错误信息:', errorMessages);
    }

    // 检查canvas元素
    const canvasInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map((canvas, idx) => ({
        index: idx,
        width: canvas.width,
        height: canvas.height,
        visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0,
        className: canvas.className,
        id: canvas.id
      }));
    });

    console.log('   Canvas元素信息:', JSON.stringify(canvasInfo, null, 2));

    // 检查是否有加载指示器
    const hasLoadingIndicator = await page.evaluate(() => {
      const loadingElements = document.querySelectorAll('[class*="loading"], [class*="Loading"], [class*="spinner"], [class*="Spinner"]');
      return loadingElements.length > 0;
    });

    console.log(`   是否有加载指示器: ${hasLoadingIndicator}`);

    console.log('\n=== Task 2: 测试发布预览图片 ===');

    // 4. 查找发布按钮
    console.log('4. 查找"发布"按钮...');
    
    const publishButtonSelectors = [
      'button:has-text("发布")',
      'button:has-text("发送")',
      'button:has-text("分享")',
      '[class*="publish"]',
      '[class*="Publish"]',
      '[data-testid*="publish"]',
      'button[type="submit"]'
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
      console.log('   未找到发布按钮，尝试获取所有按钮信息...');
      const allButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        return Array.from(buttons).map(btn => ({
          text: btn.textContent?.trim(),
          className: btn.className,
          id: btn.id,
          type: btn.type,
          disabled: btn.disabled
        }));
      });
      console.log('   页面上的所有按钮:', JSON.stringify(allButtons, null, 2));
      
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

    console.log('   发布按钮状态:', JSON.stringify(buttonInfo, null, 2));

    if (buttonInfo?.disabled || buttonInfo?.ariaDisabled === 'true') {
      console.log('   ⚠️ 发布按钮被禁用了！');
      console.log('   尝试分析原因...');
      
      // 检查页面状态，找出按钮被禁用的原因
      const pageState = await page.evaluate(() => {
        // 检查是否有加载状态
        const isLoading = !!document.querySelector('[class*="loading"], [class*="Loading"]');
        
        // 检查是否有错误消息
        const errors = Array.from(document.querySelectorAll('[class*="error"], [class*="Error"]'))
          .map(el => el.textContent?.trim())
          .filter(Boolean);
        
        // 检查canvas中是否有内容
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const canvasWithContent = canvases.filter(c => {
          const ctx = c.getContext('2d');
          if (!ctx) return false;
          const imageData = ctx.getImageData(0, 0, c.width, c.height);
          return imageData.data.some(v => v !== 0);
        });
        
        return {
          isLoading,
          errors,
          totalCanvases: canvases.length,
          canvasesWithContent: canvasWithContent.length
        };
      });

      console.log('   页面状态:', JSON.stringify(pageState, null, 2));

      // 尝试强制启用按钮进行测试
      console.log('   尝试强制启用按钮以继续测试...');
      await publishButton.evaluate((btn) => {
        (btn as HTMLButtonElement).disabled = false;
        btn.removeAttribute('aria-disabled');
      });
    }

    // 5. 点击发布按钮
    console.log('5. 点击发布按钮...');
    try {
      await publishButton.click({ timeout: 5000 });
    } catch (error) {
      console.log('   点击失败，尝试使用JavaScript点击...');
      await publishButton.evaluate((btn) => {
        (btn as HTMLButtonElement).click();
      });
    }

    // 6. 等待最多10秒让模态框渲染
    console.log('6. 等待最多10秒让模态框渲染...');
    await page.waitForTimeout(3000);

    // 尝试查找模态框
    const modalSelectors = [
      '[role="dialog"]',
      '[class*="modal"]',
      '[class*="Modal"]',
      '[class*="dialog"]',
      '[class*="Dialog"]',
      '.ant-modal', // Ant Design
      '.el-dialog', // Element UI
    ];

    let modalFound = false;
    for (const selector of modalSelectors) {
      const modal = await page.$(selector);
      if (modal && await modal.isVisible()) {
        console.log(`   找到模态框: ${selector}`);
        modalFound = true;
        break;
      }
    }

    // 等待额外时间确保预览图片加载
    await page.waitForTimeout(7000);

    // 7. 截图模态框
    const screenshot2Path = path.join(__dirname, 'publish-modal-screenshot.png');
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`7. 模态框截图已保存到: ${screenshot2Path}`);

    // 8. 分析预览图片
    console.log('8. 分析预览图片...');
    
    const previewImageInfo = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const canvases = document.querySelectorAll('canvas');
      
      const imageInfo = Array.from(images).map((img, idx) => ({
        type: 'img',
        index: idx,
        src: img.src,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
        alt: img.alt,
        className: img.className
      }));

      const canvasInfo = Array.from(canvases).map((canvas, idx) => ({
        type: 'canvas',
        index: idx,
        width: canvas.width,
        height: canvas.height,
        visible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0,
        className: canvas.className
      }));

      return { images: imageInfo, canvases: canvasInfo };
    });

    console.log('   预览区域的图片元素:', JSON.stringify(previewImageInfo.images, null, 2));
    console.log('   预览区域的Canvas元素:', JSON.stringify(previewImageInfo.canvases, null, 2));

    // 检查预览图片状态
    const hasPreviewImage = previewImageInfo.images.some(img => 
      img.visible && img.naturalWidth > 0 && img.naturalHeight > 0
    ) || previewImageInfo.canvases.some(canvas => canvas.visible);

    console.log(`   是否有可见的预览图片: ${hasPreviewImage}`);

    if (hasPreviewImage) {
      const visibleImages = previewImageInfo.images.filter(img => 
        img.visible && img.naturalWidth > 0
      );
      if (visibleImages.length > 0) {
        const img = visibleImages[0];
        console.log(`   预览图片尺寸: ${img.naturalWidth} x ${img.naturalHeight}`);
        console.log(`   预览图片显示尺寸: ${img.width} x ${img.height}`);
      }
    }

    // 输出最终报告
    console.log('\n=== 测试报告 ===');
    console.log(`Task 1 - 3D模型查看器状态:`);
    console.log(`  - 找到模型容器: ${modelFound}`);
    console.log(`  - Canvas元素数量: ${canvasInfo.length}`);
    console.log(`  - 有加载指示器: ${hasLoadingIndicator}`);
    
    console.log(`\nTask 2 - 发布预览状态:`);
    console.log(`  - 找到发布按钮: ${!!publishButton} (${usedSelector})`);
    console.log(`  - 找到模态框: ${modalFound}`);
    console.log(`  - 有预览图片: ${hasPreviewImage}`);
    console.log(`  - 图片元素数量: ${previewImageInfo.images.length}`);
    console.log(`  - Canvas元素数量: ${previewImageInfo.canvases.length}`);
  });
});
