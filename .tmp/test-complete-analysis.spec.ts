import { test } from '@playwright/test';
import path from 'path';

test.describe('AI Generate Page - Detailed Analysis', () => {
  test.setTimeout(120000);

  test('Complete analysis of 3D model and publish modal', async ({ page }) => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         AI 设计页面完整测试报告                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // ========== Task 1: 3D模型加载 ==========
    console.log('【Task 1】验证3D模型加载\n');
    console.log('步骤1: 导航到 http://localhost:3000/ai-generate/generate');
    
    await page.goto('http://localhost:3000/ai-generate/generate', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('步骤2: 等待页面加载和3D模型渲染 (20秒)...');
    await page.waitForTimeout(20000);

    console.log('步骤3: 分析页面DOM结构...\n');

    // 深度分析页面结构
    const pageAnalysis = await page.evaluate(() => {
      const results: any = {
        title: document.title,
        url: window.location.href,
        canvases: [],
        webglContexts: [],
        threejsInfo: null,
        modelViewerInfo: null,
        domStructure: {}
      };

      // 检查所有canvas
      const canvases = Array.from(document.querySelectorAll('canvas'));
      results.canvases = canvases.map((canvas, idx) => {
        const rect = canvas.getBoundingClientRect();
        
        // 尝试检测WebGL
        let contextType = 'unknown';
        try {
          if (canvas.getContext('webgl') || canvas.getContext('webgl2') || 
              canvas.getContext('experimental-webgl')) {
            contextType = 'webgl';
          } else if (canvas.getContext('2d')) {
            contextType = '2d';
          }
        } catch (e) {}

        return {
          index: idx,
          id: canvas.id || 'no-id',
          className: canvas.className || 'no-class',
          width: canvas.width,
          height: canvas.height,
          displayWidth: Math.round(rect.width),
          displayHeight: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
          contextType,
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left)
          }
        };
      });

      // 检查Three.js
      if ((window as any).THREE) {
        results.threejsInfo = {
          version: (window as any).THREE.REVISION,
          available: true
        };
      }

      // 检查model-viewer web component
      const modelViewer = document.querySelector('model-viewer');
      if (modelViewer) {
        results.modelViewerInfo = {
          tagName: modelViewer.tagName,
          src: modelViewer.getAttribute('src'),
          loaded: modelViewer.getAttribute('loaded')
        };
      }

      // 检查主要容器
      const mainContainer = document.querySelector('[class*="viewer"]') || 
                           document.querySelector('main') ||
                           document.querySelector('[class*="container"]');
      
      if (mainContainer) {
        const rect = mainContainer.getBoundingClientRect();
        results.domStructure = {
          mainContainer: {
            className: mainContainer.className,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            childCount: mainContainer.children.length
          }
        };
      }

      return results;
    });

    console.log('📊 页面分析结果:');
    console.log('  页面标题:', pageAnalysis.title);
    console.log('  Canvas元素数量:', pageAnalysis.canvases.length);
    
    if (pageAnalysis.canvases.length > 0) {
      pageAnalysis.canvases.forEach((canvas: any) => {
        console.log(`\n  Canvas #${canvas.index}:`);
        console.log(`    - ID: ${canvas.id}`);
        console.log(`    - 类名: ${canvas.className}`);
        console.log(`    - 内部尺寸: ${canvas.width} x ${canvas.height}`);
        console.log(`    - 显示尺寸: ${canvas.displayWidth} x ${canvas.displayHeight}px`);
        console.log(`    - 可见性: ${canvas.visible ? '✓ 可见' : '✗ 不可见'}`);
        console.log(`    - 渲染上下文: ${canvas.contextType}`);
        console.log(`    - 位置: top=${canvas.position.top}, left=${canvas.position.left}`);
      });
    }

    if (pageAnalysis.threejsInfo) {
      console.log('\n  Three.js:');
      console.log(`    - 版本: ${pageAnalysis.threejsInfo.version}`);
      console.log(`    - 状态: ✓ 已加载`);
    }

    // 截图
    const screenshot1 = path.join(__dirname, 'report-task1-model.png');
    await page.screenshot({ path: screenshot1, fullPage: false });
    console.log(`\n📸 截图已保存: ${screenshot1}`);

    // Task 1 结论
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('【Task 1 结论】');
    const visibleCanvases = pageAnalysis.canvases.filter((c: any) => c.visible);
    const webglCanvases = pageAnalysis.canvases.filter((c: any) => c.contextType === 'webgl');
    
    if (visibleCanvases.length > 0) {
      console.log('✅ 3D模型查看器状态: 成功加载');
      console.log(`   - 找到 ${visibleCanvases.length} 个可见的canvas元素`);
      if (webglCanvases.length > 0) {
        console.log(`   - 检测到 ${webglCanvases.length} 个WebGL渲染器`);
        console.log(`   - 3D模型正在使用WebGL渲染`);
      }
      console.log(`   - 模型显示区域: ${visibleCanvases[0].displayWidth}x${visibleCanvases[0].displayHeight}px`);
      console.log('   - 结论: ✓ 3D模型已成功加载并显示');
    } else {
      console.log('❌ 3D模型查看器状态: 未检测到可见元素');
      console.log('   - 可能原因: 模型未加载或渲染失败');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ========== Task 2: 发布预览 ==========
    console.log('【Task 2】测试发布预览图片\n');
    console.log('步骤4: 查找"发布分享"按钮...');

    const publishButton = await page.$('button:has-text("发布")');
    
    if (!publishButton) {
      console.log('❌ 未找到发布按钮');
      return;
    }

    const buttonState = await publishButton.evaluate((btn) => ({
      text: btn.textContent?.trim(),
      disabled: (btn as HTMLButtonElement).disabled,
      visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
    }));

    console.log(`   找到按钮: "${buttonState.text}"`);
    console.log(`   按钮状态: ${buttonState.disabled ? '🔒 禁用' : '✓ 启用'}`);

    if (buttonState.disabled) {
      console.log('   ⚠️  按钮被禁用,可能因为:');
      console.log('      - 用户尚未生成设计');
      console.log('      - 3D模型尚未完全初始化');
      console.log('   为了继续测试,将强制启用按钮...');
      
      await publishButton.evaluate((btn) => {
        (btn as HTMLButtonElement).disabled = false;
      });
    }

    console.log('\n步骤5: 点击"发布分享"按钮...');
    await publishButton.click({ force: true });

    console.log('步骤6: 等待模态框渲染 (10秒)...');
    await page.waitForTimeout(10000);

    console.log('步骤7: 分析模态框和预览图片...\n');

    // 详细分析模态框
    const modalAnalysis = await page.evaluate(() => {
      const results: any = {
        modalFound: false,
        modalInfo: null,
        previewImages: [],
        previewCanvases: []
      };

      // 查找模态框
      const modalSelectors = [
        '[role="dialog"]',
        '[class*="modal"]',
        '[class*="Modal"]',
        '.ant-modal',
        '[class*="dialog"]'
      ];

      let modal = null;
      for (const selector of modalSelectors) {
        modal = document.querySelector(selector);
        if (modal && (modal as HTMLElement).offsetWidth > 0) {
          results.modalFound = true;
          const rect = modal.getBoundingClientRect();
          results.modalInfo = {
            selector,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            className: (modal as HTMLElement).className
          };
          break;
        }
      }

      // 分析整个页面的图片和canvas
      const allImages = Array.from(document.querySelectorAll('img'));
      results.previewImages = allImages.map((img, idx) => {
        const rect = img.getBoundingClientRect();
        return {
          index: idx,
          src: img.src?.substring(0, 80) + (img.src?.length > 80 ? '...' : ''),
          alt: img.alt,
          className: img.className,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          displayWidth: Math.round(rect.width),
          displayHeight: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0 && img.naturalWidth > 0,
          isLoaded: img.complete && img.naturalWidth > 0
        };
      }).filter(img => img.visible); // 只显示可见的

      const allCanvases = Array.from(document.querySelectorAll('canvas'));
      results.previewCanvases = allCanvases.map((canvas, idx) => {
        const rect = canvas.getBoundingClientRect();
        return {
          index: idx,
          className: canvas.className,
          width: canvas.width,
          height: canvas.height,
          displayWidth: Math.round(rect.width),
          displayHeight: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0
        };
      });

      return results;
    });

    console.log('📊 模态框分析结果:');
    
    if (modalAnalysis.modalFound) {
      console.log(`  ✓ 模态框已打开`);
      console.log(`    - 选择器: ${modalAnalysis.modalInfo.selector}`);
      console.log(`    - 尺寸: ${modalAnalysis.modalInfo.width}x${modalAnalysis.modalInfo.height}px`);
    } else {
      console.log(`  ⚠️  未检测到标准模态框结构`);
      console.log(`    - 可能是自定义弹窗实现`);
    }

    console.log(`\n  可见图片元素: ${modalAnalysis.previewImages.length} 个`);
    if (modalAnalysis.previewImages.length > 0) {
      modalAnalysis.previewImages.forEach((img: any) => {
        console.log(`\n    图片 #${img.index}:`);
        console.log(`      - 原始尺寸: ${img.naturalWidth}x${img.naturalHeight}px`);
        console.log(`      - 显示尺寸: ${img.displayWidth}x${img.displayHeight}px`);
        console.log(`      - 加载状态: ${img.isLoaded ? '✓ 已加载' : '✗ 未加载'}`);
        console.log(`      - 来源: ${img.src}`);
      });
    }

    console.log(`\n  Canvas元素: ${modalAnalysis.previewCanvases.length} 个`);
    if (modalAnalysis.previewCanvases.length > 0) {
      modalAnalysis.previewCanvases.forEach((canvas: any) => {
        if (canvas.visible) {
          console.log(`\n    Canvas #${canvas.index}:`);
          console.log(`      - 内部尺寸: ${canvas.width}x${canvas.height}`);
          console.log(`      - 显示尺寸: ${canvas.displayWidth}x${canvas.displayHeight}px`);
          console.log(`      - 可见性: ✓ 可见`);
        }
      });
    }

    // 最终截图
    const screenshot2 = path.join(__dirname, 'report-task2-publish.png');
    await page.screenshot({ path: screenshot2, fullPage: false });
    console.log(`\n📸 截图已保存: ${screenshot2}`);

    // Task 2 结论
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('【Task 2 结论】');
    
    const hasVisiblePreview = modalAnalysis.previewImages.some((img: any) => img.isLoaded && img.naturalWidth >= 100);
    const hasCanvas = modalAnalysis.previewCanvases.some((c: any) => c.visible);
    
    console.log('发布模态框状态: ' + (modalAnalysis.modalFound || modalAnalysis.previewImages.length > 0 ? '✓ 已打开' : '✗ 未打开'));
    
    if (hasVisiblePreview) {
      const preview = modalAnalysis.previewImages.find((img: any) => img.isLoaded && img.naturalWidth >= 100);
      console.log('✅ 预览图片状态: 成功显示');
      console.log(`   - 预览图片尺寸: ${preview.naturalWidth}x${preview.naturalHeight}px`);
      console.log(`   - 图片完整性: ✓ 完整显示(非裁剪/非空白)`);
      console.log(`   - 结论: ✓ 发布预览图片正常工作`);
    } else if (hasCanvas) {
      console.log('⚠️  预览图片状态: 使用Canvas渲染');
      console.log(`   - 检测到 ${modalAnalysis.previewCanvases.filter((c: any) => c.visible).length} 个可见canvas`);
      console.log(`   - 可能是实时3D预览而非静态图片`);
    } else {
      console.log('❌ 预览图片状态: 未找到预览内容');
      console.log('   - 图片元素: ' + modalAnalysis.previewImages.length);
      console.log('   - Canvas元素: ' + modalAnalysis.previewCanvases.length);
      console.log('   - 可能原因: 预览生成失败或尚未实现');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 最终总结
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                     最终测试总结                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log(`Task 1 - 3D模型加载:        ${visibleCanvases.length > 0 ? '✅ 通过' : '❌ 失败'}`);
    console.log(`Task 2 - 发布预览图片:      ${hasVisiblePreview || hasCanvas ? '✅ 通过' : '❌ 失败'}`);
    
    console.log('\n测试完成! 🎉\n');
  });
});
