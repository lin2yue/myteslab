import { test, expect } from '@playwright/test';

test('AI Generate page - Test Publish Preview with History', async ({ page }) => {
  console.log('========================================');
  console.log('开始测试 AI 发布预览功能');
  console.log('========================================');

  // 监听控制台消息
  page.on('console', (msg) => {
    console.log(`[Browser ${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.log(`[Page Error] ${err.message}`);
  });

  // 步骤 1: 导航到页面
  console.log('\n步骤 1: 导航到 AI 生成页面...');
  await page.goto('http://localhost:3000/ai-generate/generate', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  console.log('✓ 页面已加载');

  // 步骤 2: 等待 10 秒让页面完全加载
  console.log('\n步骤 2: 等待 10 秒让 3D 模型加载...');
  await page.waitForTimeout(10000);

  // 步骤 3: 截图确认模型可见
  console.log('\n步骤 3: 截取页面截图确认模型加载...');
  await page.screenshot({ 
    path: '.tmp/step3-model-loaded.png',
    fullPage: true
  });
  console.log('✓ 截图已保存: .tmp/step3-model-loaded.png');

  // 检查 3D 模型是否存在
  const modelViewer = page.locator('model-viewer');
  const modelCount = await modelViewer.count();
  console.log(`\n=== 3D 模型检查 ===`);
  console.log(`找到 ${modelCount} 个 model-viewer 元素`);
  if (modelCount > 0) {
    const isVisible = await modelViewer.first().isVisible();
    console.log(`3D 模型是否可见: ${isVisible ? '✓ 是' : '✗ 否'}`);
  }

  // 步骤 4: 查找右侧面板的历史记录
  console.log('\n步骤 4: 检查右侧面板的生成历史...');
  
  // 查找所有可能的历史记录容器
  const historySelectors = [
    '[class*="history"]',
    '[class*="History"]',
    '[class*="sidebar"]',
    '[class*="panel"]',
    'aside',
    '[class*="generated"]',
    'img[src*="blob"]',
    'img[src*="data:image"]',
  ];

  let historyItems: any[] = [];
  for (const selector of historySelectors) {
    const elements = page.locator(selector);
    const count = await elements.count();
    if (count > 0) {
      console.log(`  找到 ${count} 个 "${selector}" 元素`);
      historyItems.push({ selector, count, elements });
    }
  }

  // 查找所有图片元素
  const allImages = page.locator('img');
  const imageCount = await allImages.count();
  console.log(`\n页面上共有 ${imageCount} 个图片元素`);

  if (imageCount > 0) {
    console.log('图片列表:');
    for (let i = 0; i < Math.min(imageCount, 10); i++) {
      const img = allImages.nth(i);
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      const isVisible = await img.isVisible();
      console.log(`  图片 ${i + 1}: src="${src?.substring(0, 60)}..." alt="${alt}" 可见=${isVisible}`);
    }
  }

  // 步骤 5: 查找发布按钮
  console.log('\n步骤 5: 查找发布按钮...');
  
  const publishButton = page.locator('button:has-text("发布")');
  const publishCount = await publishButton.count();
  
  if (publishCount === 0) {
    console.log('✗ 未找到发布按钮');
    const allButtons = await page.locator('button').allTextContents();
    console.log('页面上所有按钮:', allButtons);
  } else {
    console.log(`✓ 找到 ${publishCount} 个发布按钮`);
    
    const isDisabled = await publishButton.first().isDisabled();
    const isVisible = await publishButton.first().isVisible();
    console.log(`发布按钮状态: 可见=${isVisible}, 禁用=${isDisabled}`);

    // 如果按钮被禁用,尝试几种方法
    if (isDisabled) {
      console.log('\n发布按钮被禁用，尝试解决方案...');
      
      // 方法 1: 尝试点击历史记录项
      console.log('\n方法 1: 查找并点击历史记录中的设计...');
      const clickableImages = page.locator('img[src*="blob"], img[src*="data:image"]').locator('visible=true');
      const clickableCount = await clickableImages.count();
      
      if (clickableCount > 0) {
        console.log(`找到 ${clickableCount} 个可能的历史设计图片，尝试点击第一个...`);
        await clickableImages.first().click();
        await page.waitForTimeout(2000);
        
        // 再次检查按钮状态
        const stillDisabled = await publishButton.first().isDisabled();
        console.log(`点击后按钮状态: 禁用=${stillDisabled}`);
        
        if (!stillDisabled) {
          console.log('✓ 按钮已启用!');
        }
      } else {
        console.log('未找到可点击的历史记录图片');
      }
      
      // 方法 2: 使用 JavaScript 强制启用按钮
      if (await publishButton.first().isDisabled()) {
        console.log('\n方法 2: 使用 JavaScript 移除 disabled 属性...');
        await publishButton.first().evaluate((btn: any) => {
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.classList.remove('disabled');
        });
        console.log('✓ 已尝试移除 disabled 属性');
      }
    }

    // 步骤 6: 尝试点击发布按钮
    console.log('\n步骤 6: 尝试点击发布按钮...');
    try {
      await publishButton.first().click({ force: true, timeout: 5000 });
      console.log('✓ 已点击发布按钮');
      
      // 等待模态框出现
      await page.waitForTimeout(2000);
      
      // 步骤 7: 检查发布模态框
      console.log('\n步骤 7: 检查发布模态框...');
      
      const modal = page.locator('[role="dialog"]').or(page.locator('.modal'));
      const modalVisible = await modal.count() > 0 && await modal.first().isVisible();
      
      console.log(`\n=== 发布模态框检查 ===`);
      console.log(`模态框是否出现: ${modalVisible ? '✓ 是' : '✗ 否'}`);
      
      if (modalVisible) {
        // 截图模态框
        console.log('\n截取发布模态框...');
        await page.screenshot({
          path: '.tmp/step7-publish-modal.png',
          fullPage: true
        });
        console.log('✓ 截图已保存: .tmp/step7-publish-modal.png');
        
        // 查找预览图片
        const previewImages = modal.locator('img');
        const previewCount = await previewImages.count();
        console.log(`\n预览图片数量: ${previewCount}`);
        
        if (previewCount > 0) {
          for (let i = 0; i < previewCount; i++) {
            const img = previewImages.nth(i);
            const box = await img.boundingBox();
            const src = await img.getAttribute('src');
            console.log(`\n预览图 ${i + 1}:`);
            console.log(`  尺寸: ${box?.width || 0} x ${box?.height || 0}`);
            console.log(`  src: ${src?.substring(0, 80)}...`);
          }
          
          console.log('\n=== 重要: 请手动检查截图 ===');
          console.log('文件: .tmp/step7-publish-modal.png');
          console.log('检查项: 预览图是否显示完整的 3D 汽车模型?');
          console.log('       还是只显示部分/裁剪的图像?');
        }
      } else {
        console.log('\n✗ 模态框未出现，可能点击失败或需要先选择设计');
        await page.screenshot({
          path: '.tmp/step7-no-modal.png',
          fullPage: true
        });
        console.log('已保存当前状态截图: .tmp/step7-no-modal.png');
      }
    } catch (error) {
      console.log(`✗ 点击发布按钮失败: ${error}`);
      await page.screenshot({
        path: '.tmp/step6-click-failed.png',
        fullPage: true
      });
      console.log('已保存错误状态截图: .tmp/step6-click-failed.png');
    }
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
});
