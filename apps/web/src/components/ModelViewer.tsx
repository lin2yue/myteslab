'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { useTranslations } from 'next-intl'

import viewerConfig from '@/config/viewer-config.json'

interface ModelViewerProps {
    modelUrl: string
    wheelUrl?: string
    textureUrl?: string
    modelSlug?: string
    className?: string
    id?: string
    autoRotate?: boolean
    environment?: string
    backgroundColor?: string
    cameraOrbit?: string
    fieldOfView?: string
    cameraControls?: boolean
}

export interface ModelViewerRef {
    takeHighResScreenshot: (options?: { zoomOut?: boolean, useStandardView?: boolean }) => Promise<string | null>;
    waitForReady: (timeout?: number) => Promise<boolean>;
}

export const ModelViewer = forwardRef<ModelViewerRef, ModelViewerProps>(({
    modelUrl,
    wheelUrl,
    textureUrl,
    modelSlug,
    className = '',
    id,
    autoRotate: propAutoRotate,
    environment = 'neutral',
    backgroundColor: propBackgroundColor,
    cameraOrbit: propCameraOrbit,
    fieldOfView: propFieldOfView,
    cameraControls = true
}, ref) => {
    const t = useTranslations('Common')
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerElementRef = useRef<any>(null)
    const [loading, setLoading] = useState(true)

    const addLog = (msg: string) => {
        console.log(msg)
    }

    const [error, setError] = useState<string | null>(null)
    const [textureLoading, setTextureLoading] = useState(false)

    // Refs for tracking readiness state without triggering re-renders
    const modelLoadedRef = useRef(false)
    const textureAppliedRef = useRef(false)

    useImperativeHandle(ref, () => ({
        waitForReady: async (timeout = 10000) => {
            const start = Date.now()
            while (Date.now() - start < timeout) {
                // If there's no textureUrl, we only care about model loading
                const textureReady = !textureUrl || textureAppliedRef.current
                if (modelLoadedRef.current && textureReady && !textureLoading) {
                    return true
                }
                await new Promise(resolve => setTimeout(resolve, 200))
            }
            return false
        },
        takeHighResScreenshot: async (options) => {
            const viewer = viewerElementRef.current;
            if (!viewer) return null;

            // Define Standard View Configuration
            const DEFAULT_ORBIT = "225deg 75deg 85%";
            const STANDARD_FOV = "30deg";
            const STANDARD_BG = "#1F1F1F";
            const STANDARD_EXPOSURE = "1.0";

            // Resolve model-specific orbit if available
            const modelConfig = modelSlug ? (viewerConfig.models as any)[modelSlug] : null;
            const targetOrbit = modelConfig?.cameraOrbit || DEFAULT_ORBIT;

            // 1. Record original state
            const originalAutoRotate = viewer.hasAttribute('auto-rotate');
            const originalMinRenderScale = viewer.getAttribute('min-render-scale');
            const originalFOV = viewer.getAttribute('field-of-view');
            const originalOrbit = viewer.getAttribute('camera-orbit');
            const originalExposure = viewer.getAttribute('exposure');
            const originalBG = viewer.style.backgroundColor;
            const originalWidth = viewer.style.width;
            const originalHeight = viewer.style.height;
            const originalParent = viewer.parentElement;
            const nextSibling = viewer.nextSibling;

            try {
                // Temporarily boost quality
                viewer.setAttribute('min-render-scale', '1');

                if (options?.useStandardView) {
                    viewer.removeAttribute('auto-rotate');
                    viewer.setAttribute('camera-orbit', targetOrbit);
                    viewer.setAttribute('field-of-view', STANDARD_FOV);
                    viewer.setAttribute('exposure', STANDARD_EXPOSURE);
                    viewer.style.backgroundColor = STANDARD_BG;

                    if (typeof viewer.jumpCameraToGoal === 'function') {
                        viewer.jumpCameraToGoal();
                    }
                }

                // Wait for renderer to settle
                await new Promise(resolve => requestAnimationFrame(resolve));
                await new Promise(resolve => requestAnimationFrame(resolve));
                await new Promise(resolve => setTimeout(resolve, 300));

                // Capture screenshot
                const blob = await viewer.toBlob({
                    mimeType: 'image/png',
                    qualityArgument: 1.0,
                    idealAspect: false
                });

                if (blob) {
                    console.log(`[ModelViewer-Debug] Captured blob size: ${blob.size} bytes`);
                }

                if (!blob) return null;

                // Composite onto Background Canvas for consistent color/alignment
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 1024;
                        canvas.height = 768;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            resolve(null);
                            return;
                        }

                        // Fill background
                        ctx.fillStyle = STANDARD_BG;
                        ctx.fillRect(0, 0, 1024, 768);

                        // Draw model image
                        console.log(`[ModelViewer-Debug] Drawing image to canvas: ${img.width}x${img.height} -> 1024x768`);
                        ctx.drawImage(img, 0, 0, 1024, 768);

                        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                        resolve(dataUrl);
                    };
                    img.src = URL.createObjectURL(blob);
                });

            } finally {
                // Restore auto-rotate state
                if (originalAutoRotate) viewer.setAttribute('auto-rotate', 'true');
                else viewer.removeAttribute('auto-rotate');

                // Restore View Attributes
                if (originalMinRenderScale) viewer.setAttribute('min-render-scale', originalMinRenderScale);
                else viewer.removeAttribute('min-render-scale');

                if (originalFOV) viewer.setAttribute('field-of-view', originalFOV);
                else viewer.removeAttribute('field-of-view');

                if (originalOrbit) viewer.setAttribute('camera-orbit', originalOrbit);
                else viewer.removeAttribute('camera-orbit');

                if (originalExposure) viewer.setAttribute('exposure', originalExposure);
                // Force model-viewer to recalculate bounds
                if ((viewer as any).updateFraming) {
                    (viewer as any).updateFraming()
                } else if (viewer.updateBoundingBox) {
                    viewer.updateBoundingBox()
                }

                // Trigger camera update to zoom in to new bounds
                if (typeof viewer.jumpCameraToGoal === 'function') {
                    viewer.jumpCameraToGoal()
                }
                // Restore Style
                viewer.style.backgroundColor = originalBG;

                if (typeof viewer.jumpCameraToGoal === 'function') {
                    viewer.jumpCameraToGoal();
                }
            }
        }
    }));

    // 获取 Three.js 场景的助手函数 (终极鲁棒版本)
    const getThreeScene = (viewer: any) => {
        try {
            // 1. 尝试直接查找带有 isScene 标志的属性 (Symbols)
            // Three.js 的 Scene 对象都有 isScene = true 属性
            const symbols = Object.getOwnPropertySymbols(viewer)
            for (const sym of symbols) {
                const val = viewer[sym]
                if (val && (val.isScene || (val.scene && val.scene.isScene))) {
                    return val.isScene ? val : val.scene
                }
            }

            // 2. 尝试常见属性名
            if (viewer.scene && viewer.scene.isScene) return viewer.scene
            if (viewer.__scene && viewer.__scene.isScene) return viewer.__scene

            // 3. 深度扫描（防止属性名混淆）
            // 注意：这比较耗时，但仅在加载时运行一次
            const keys = Object.getOwnPropertyNames(viewer)
            for (const key of keys) {
                const val = viewer[key]
                if (val && (val.isScene || (val.scene && val.scene.isScene))) {
                    return val.isScene ? val : val.scene
                }
            }

            return null
        } catch (e) {
            console.error('[ModelViewer] getThreeScene error:', e)
            return null
        }
    }

    // 辅助：检查是否为轮毂锚点
    const isWheelAnchorNode = (name: string): boolean => {
        const n = name.toUpperCase()
        return n.includes('WHEEL') && (
            n.includes('SPATIAL') ||
            n.includes('LF') || n.includes('RF') ||
            n.includes('RL') || n.includes('RR') ||
            n.includes('_F') || n.includes('_R') ||
            n.includes('FL') || n.includes('FR')
        )
    }

    // 辅助：清理场景（移除地板、光源等）
    const cleanScene = (viewer: any) => {
        const scene = getThreeScene(viewer)
        if (!scene || typeof scene.traverse !== 'function') return

        const objectsToRemove: any[] = []
        scene.traverse((node: any) => {
            const name = (node.name || '').toUpperCase()
            // 移除地板/地面
            if (name.includes('FLOOR') || name.includes('GROUND')) {
                objectsToRemove.push(node)
                return
            }

            // 移除内置的轮毂（如果存在），防止与注入的轮毂重叠
            // 逻辑：如果名字包含 WHEEL 且是一个 Mesh，且不是我们要用的 Spatial 锚点，就删掉它
            // UPDATE: 如果它看起来像一个有效的锚点（比如 Wheel_FL），不要删除它！
            // 留给 injectWheels 去处理（剥离几何体并挂载新轮毂）
            if (name.includes('WHEEL') && node.isMesh && !isWheelAnchorNode(name)) {
                // 特殊检查：有些模型直接把轮子挂在根部或者其他地方
                console.log(`[ModelViewer] Found redundant wheel mesh to remove: ${node.name}`)
                objectsToRemove.push(node)
            }
        })

        if (objectsToRemove.length > 0) {
            objectsToRemove.forEach((node: any) => {
                if (node.parent) {
                    try {
                        node.parent.remove(node)
                    } catch (e) {
                        console.warn('Failed to remove node:', node.name)
                    }
                }
            })
            console.log(`[ModelViewer] Cleaned up ${objectsToRemove.length} nodes via cleanScene helper.`)

            if (viewer.updateBoundingBox) viewer.updateBoundingBox()
            if ((viewer as any).updateFraming) (viewer as any).updateFraming()
        }
    }

    // Ground the model (not the whole scene) so its lowest point rests on Y=0
    // This fixes "floating" shadows when wheels are injected after load
    const groundModel = async (viewer: any) => {
        const scene: any = getThreeScene(viewer)
        const model = scene?.model
        if (!scene || !model) return

        try {
            const { Box3 } = await import('three')
            const box = new Box3().setFromObject(model)
            if (!box.isEmpty()) {
                const minY = box.min.y
                if (Math.abs(minY) > 1e-4) {
                    model.position.y -= minY
                }
            }

            if (typeof scene.updateBoundingBox === 'function') {
                scene.updateBoundingBox()
            }
            if (typeof scene.updateShadow === 'function') {
                scene.updateShadow()
            }
            if (typeof scene.queueRender === 'function') {
                scene.queueRender()
            }
        } catch (e) {
            console.warn('[ModelViewer] groundModel failed:', e)
        }
    }

    // 动态注入轮毂模型
    const injectWheels = async (viewer: any, wheelUrl: string) => {
        if (!viewer || !wheelUrl) return

        try {
            const scene = getThreeScene(viewer)
            if (!scene || typeof scene.traverse !== 'function') {
                return
            }

            // 执行场景清理
            cleanScene(viewer)

            addLog('[ModelViewer] Injecting modular wheels: ' + wheelUrl)

            // 动态导入 Three.js 加载器
            // 使用并行导入提高效率
            let modules
            try {
                modules = await Promise.all([
                    import('three/examples/jsm/loaders/GLTFLoader'),
                    import('three/examples/jsm/loaders/DRACOLoader'),
                    import('three/examples/jsm/utils/SkeletonUtils'),
                    import('three')
                ])
            } catch (err) {
                addLog(`[Error] Failed to import Three.js modules: ${err}`)
                return
            }

            const [{ GLTFLoader }, { DRACOLoader }, SkeletonUtils, THREE] = modules

            const loader = new GLTFLoader()

            // 配置 DRACOLoader
            const dracoLoader = new DRACOLoader()
            // 使用与 model-viewer 相同的解码器路径 (Google CDN)
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
            dracoLoader.setDecoderConfig({ type: 'js' }) // 强制使用 JS 版本以避免 WASM 兼容性问题 (可选)
            loader.setDRACOLoader(dracoLoader)

            // 1. 加载轮毂母本
            let gltf
            try {
                gltf = await loader.loadAsync(wheelUrl)
            } catch (err) {
                addLog(`[Error] Failed to load wheel GLB: ${err}`)
                return
            }

            const wheelMaster = gltf.scene
            addLog('[Debug] Wheel GLB loaded.')

            // 2. 寻找挂载点
            const foundAnchors: any[] = []

            if (!scene.traverse) {
                addLog('[Error] Scene object does not have traverse method!')
                return
            }

            scene.traverse((node: any) => {
                const name = (node.name || '').toUpperCase()
                if (isWheelAnchorNode(name) && !name.includes('STEERING')) {
                    foundAnchors.push(node)
                }
            })

            if (foundAnchors.length === 0) {
                console.warn('[ModelViewer] No wheel anchors found in scene! Available nodes:',
                    (() => {
                        const nodes: string[] = [];
                        scene.traverse((n: any) => nodes.push(n.name));
                        return nodes.slice(0, 50).join(', ') + (nodes.length > 50 ? '...' : '');
                    })()
                );
                return
            }

            addLog(`[Debug] Found ${foundAnchors.length} anchors: ${foundAnchors.map(a => a.name).join(', ')}`)

            // 3. 克隆并挂载
            foundAnchors.forEach((node) => {
                // 如果锚点本身是一个 Mesh (标准 GLTF 导出结构)，我们需要“阉割”它：
                // 移除它的几何体和材质，使其变成一个纯粹的 Transform 节点
                // 这样即使原始轮毂没被 cleanScene 删除，也不会渲染出来
                if (node.isMesh) {
                    console.log(`[ModelViewer] Converting mesh anchor to container: ${node.name}`)
                    if (node.geometry) node.geometry.dispose()
                    if (node.material) {
                        if (Array.isArray(node.material)) node.material.forEach((m: any) => m.dispose())
                        else node.material.dispose()
                    }
                    node.geometry = undefined
                    node.material = undefined
                    node.isMesh = false
                    node.type = 'Object3D'
                }

                // 清除子节点（防止重复添加）
                while (node.children.length > 0) node.remove(node.children[0])

                const wheelInstance = SkeletonUtils.clone(wheelMaster)
                const name = node.name.toUpperCase()

                // 强制更新矩阵，确保世界坐标正确 calculation
                try {
                    addLog(`[Debug] Processing anchor: ${node.name} (Type: ${node.type})`)

                    if (typeof node.updateMatrixWorld === 'function') {
                        node.updateMatrixWorld(true)
                    }

                    // 强制重置锚点状态
                    node.visible = true
                    if (node.scale.length() < 0.1) node.scale.set(1, 1, 1)

                    // 旋转判断：
                    // 用户反馈右侧反了 (PI)，说明不需要旋转，跟随锚点即可。
                    wheelInstance.rotation.y = 0

                    wheelInstance.scale.set(1.0, 1.0, 1.0)

                    wheelInstance.traverse((child: any) => {
                        if (child.isMesh) {
                            child.frustumCulled = false
                            // Ensure injected wheels participate in model-viewer shadows
                            child.castShadow = true
                            child.receiveShadow = true
                            if (child.material) {
                                child.material.needsUpdate = true
                                child.material.visible = true
                                child.material.side = 2
                            }
                        }
                    })

                    node.add(wheelInstance)

                } catch (loopErr: any) {
                    console.error(`Failed on ${name}:`, loopErr)
                }
            })


            console.log(`[ModelViewer] Successfully injected wheels to ${foundAnchors.length} positions`)
        } catch (err: any) {
            const errMsg = `[ModelViewer] Failed to inject wheels: ${err.message}`
            console.error(errMsg)
            addLog(`[ERROR] ${errMsg}`)
        }
    }

    // 处理贴图应用逻辑
    const applyTexture = async (viewer: any, url: string, slug?: string) => {
        if (!viewer || !url) return
        setTextureLoading(true)
        textureAppliedRef.current = false

        const maxRetries = 3
        let lastError: any = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[ModelViewer] Loading texture (attempt ${attempt}/${maxRetries}): ${url.substring(0, 100)}...`)

                const config = {
                    ...viewerConfig.defaults,
                    ...(slug && (viewerConfig.models as any)[slug] ? (viewerConfig.models as any)[slug] : {})
                }

                const texture = await viewer.createTexture(url)
                const materials = viewer.model.materials

                // 1. 通过 Model Viewer API 设置纹理
                materials.forEach((material: any) => {
                    const name = material.name?.toLowerCase() || ''
                    const isBody = name === '' ||
                        name.includes('paint') ||
                        name.includes('body') ||
                        name.includes('exterior') ||
                        name.includes('stainless') ||
                        name === 'ext_body'

                    if (isBody) {
                        try {
                            if (material.pbrMetallicRoughness.baseColorTexture) {
                                material.pbrMetallicRoughness.baseColorTexture.setTexture(texture)
                            } else {
                                // Fallback: try to create a default texture if it lacks one
                                material.pbrMetallicRoughness.baseColorTexture = { texture }
                            }

                            // 关键：恢复并应用镜像/缩放/旋转参数
                            const threeTexture = (texture as any).source?.texture || (texture as any).texture
                            if (threeTexture) {
                                threeTexture.flipY = false
                                threeTexture.center.set(0.5, 0.5)

                                // 应用配置中的旋转
                                threeTexture.rotation = (config.rotation || 0) * (Math.PI / 180)

                                // 应用缩放和镜像逻辑
                                const scaleX = config.mirror ? -(config.scale || 1) : (config.scale || 1)
                                const scaleY = config.scale || 1
                                threeTexture.repeat.set(scaleX, scaleY)

                                // 修正侧面平移 (镜像时需要偏移 1.0)
                                if (config.mirror) {
                                    threeTexture.offset.set(1, 0)
                                } else {
                                    threeTexture.offset.set(0, 0)
                                }

                                threeTexture.wrapS = 1000 // RepeatWrapping
                                threeTexture.wrapT = 1000 // RepeatWrapping
                                threeTexture.needsUpdate = true
                            }
                        } catch (e) {
                            console.warn(`Model Viewer API 设置材质 ${name} 失败:`, e)
                        }
                    }
                })

                console.log(`[ModelViewer] Texture loaded successfully on attempt ${attempt}`)
                setTextureLoading(false)
                textureAppliedRef.current = true
                return // Success, exit retry loop

            } catch (err) {
                lastError = err
                console.error(`[ModelViewer] Texture loading failed (attempt ${attempt}/${maxRetries}):`, err)

                if (attempt < maxRetries) {
                    // Exponential backoff: wait 500ms, 1000ms, 2000ms
                    const delay = 500 * Math.pow(2, attempt - 1)
                    console.log(`[ModelViewer] Retrying in ${delay}ms...`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                } else {
                    console.error(`[ModelViewer] All ${maxRetries} attempts failed for texture: ${url}`)
                }
            }
        }

        // All retries failed
        setTextureLoading(false)
        textureAppliedRef.current = false
    }

    // Effect 1: Handle model element creation and modelUrl changes
    useEffect(() => {
        import('@google/model-viewer')
        if (!containerRef.current) return

        setLoading(true)
        setError(null)
        modelLoadedRef.current = false
        textureAppliedRef.current = false

        const viewer = document.createElement('model-viewer') as any
        if (id) viewer.id = id
        viewerElementRef.current = viewer

        const config = {
            ...viewerConfig.defaults,
            ...(modelSlug && (viewerConfig.models as any)[modelSlug] ? (viewerConfig.models as any)[modelSlug] : {})
        }

        viewer.setAttribute('src', modelUrl)
        viewer.setAttribute('crossorigin', 'anonymous')
        if (cameraControls) {
            viewer.setAttribute('camera-controls', 'true')
            viewer.setAttribute('touch-action', 'none')
        } else {
            viewer.removeAttribute('camera-controls')
            viewer.setAttribute('touch-action', 'auto')
        }
        viewer.setAttribute('interaction-prompt', config.interactionPrompt || 'none')
        viewer.setAttribute('camera-orbit', propCameraOrbit || config.cameraOrbit)
        viewer.setAttribute('field-of-view', propFieldOfView || config.fieldOfView)
        viewer.setAttribute('environment-image', environment || config.environmentImage)
        viewer.setAttribute('shadow-intensity', config.shadowIntensity.toString())
        viewer.setAttribute('shadow-softness', config.shadowSoftness.toString())
        viewer.setAttribute('exposure', config.exposure.toString())

        // Restrict vertical angle to prevent looking from too far below
        // Theta (vertical) limits: 0deg (top) to 180deg (bottom). 
        // 90deg is horizontal (ground level).
        viewer.setAttribute('min-camera-orbit', 'auto 0deg auto')
        viewer.setAttribute('max-camera-orbit', 'auto 90deg auto')

        viewer.style.width = '100%'
        viewer.style.height = '100%'
        if (propBackgroundColor) viewer.style.backgroundColor = propBackgroundColor

        // Ensure auto-rotate is applied if enabled in state
        if (propAutoRotate) {
            viewer.setAttribute('auto-rotate', 'true')
        }

        const onLoad = async () => {
            modelLoadedRef.current = true

            // UV Map 修复：处理左右对称贴图问题 (还原之前的稳健方案)
            const scene = getThreeScene(viewer)
            if (scene) {
                let availableUVs = ['uv']
                scene.traverse((node: any) => {
                    if (node.isMesh && node.geometry) {
                        if (node.geometry.attributes.uv1 && !availableUVs.includes('uv1')) {
                            availableUVs.push('uv1')
                        }
                    }
                })

                console.log(`[ModelViewer] Available UV sets: ${availableUVs.join(', ')}`)

                // 优先使用配置，如果没有配置则自动检测 uv1
                const targetUV = config.uvSet === 'uv1' || (config.uvSet === undefined && availableUVs.includes('uv1')) ? 'uvSet' : 'uv'

                // 注意：这里使用的是三维层面的属性替换，而不是材质层面的通道切换
                if (targetUV !== 'uv' || config.uvSet === 'uv1') {
                    const actualTarget = availableUVs.includes('uv1') ? 'uv1' : (availableUVs.includes('uv2') ? 'uv2' : 'uv')

                    if (actualTarget !== 'uv') {
                        scene.traverse((node: any) => {
                            if (node.isMesh && node.geometry) {
                                const geom = node.geometry
                                const name = (node.name || '').toLowerCase()
                                const matName = (node.material?.name || '').toLowerCase()
                                const isBody = name.includes('paint') || name.includes('body') || name.includes('exterior') ||
                                    matName.includes('paint') || matName.includes('body') || matName.includes('exterior')

                                if (isBody && geom.attributes[actualTarget]) {
                                    if (!geom.userData.originalUV) {
                                        geom.userData.originalUV = geom.attributes.uv
                                    }
                                    console.log(`[ModelViewer] Swapping UV to ${actualTarget} for mesh: ${node.name}`)
                                    geom.attributes.uv = geom.attributes[actualTarget]
                                    geom.attributes.uv.needsUpdate = true
                                }
                            }
                        })
                    }
                }
            }

            // Always attempt to clean scene, even if no wheels (e.g. just removing floor)
            // But we need to be careful not to introduce race conditions.
            // If wheelUrl is present, injectWheels handles cleanup.
            // If NOT present, we should call cleanScene here.

            // Optimized loading sequence: Remove hardcoded timeouts and use proper frame synchronization
            const initializeViewerState = async () => {
                try {
                    // Wait for model-viewer internal updates
                    if (viewer.updateComplete) {
                        await viewer.updateComplete;
                    }

                    // Double RAF ensures Three.js scene graph is fully built and accessible
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    await new Promise(resolve => requestAnimationFrame(resolve));

                    if (wheelUrl) {
                        await injectWheels(viewer, wheelUrl);
                    } else {
                        cleanScene(viewer);
                    }

                    await groundModel(viewer);

                    // Final layout and rendering updates
                    if ((viewer as any).updateFraming) {
                        (viewer as any).updateFraming();
                    } else if (viewer.updateBoundingBox) {
                        viewer.updateBoundingBox();
                    }

                    if (typeof viewer.jumpCameraToGoal === 'function') {
                        viewer.jumpCameraToGoal();
                    }

                    if (typeof (viewer as any).requestRender === 'function') {
                        (viewer as any).requestRender();
                    }

                    setLoading(false);
                } catch (err) {
                    console.error('[ModelViewer] Post-load initialization failed:', err);
                    setLoading(false);
                }
            };

            initializeViewerState();

            // Once loaded, apply current texture if any
            if (textureUrl) {
                applyTexture(viewer, textureUrl, modelSlug)
            }
        }

        const onError = (event: any) => {
            console.error('Model failed to load:', event)
            setError(t('model_error'))
            setLoading(false)
        }

        viewer.addEventListener('load', onLoad)
        viewer.addEventListener('error', onError)
        containerRef.current.appendChild(viewer)

        return () => {
            viewer.removeEventListener('load', onLoad)
            viewer.removeEventListener('error', onError)
            viewer.remove()
        }
    }, [modelUrl, wheelUrl, id]) // Re-run only on core model identity change

    // Effect 2: Update model-viewer attributes that don't need reload
    useEffect(() => {
        const viewer = viewerElementRef.current
        if (!viewer) return

        if (propAutoRotate) {
            viewer.setAttribute('auto-rotate', 'true')
        } else {
            viewer.removeAttribute('auto-rotate')
        }
    }, [propAutoRotate])

    // Effect 3: Update appearance (background, environment, exposure) without reload
    useEffect(() => {
        const viewer = viewerElementRef.current
        if (!viewer) return

        if (propBackgroundColor) {
            viewer.style.backgroundColor = propBackgroundColor
        }

        const config = {
            ...viewerConfig.defaults,
            ...(modelSlug && (viewerConfig.models as any)[modelSlug] ? (viewerConfig.models as any)[modelSlug] : {})
        }

        // Apply environment image
        const finalEnv = environment || config.environmentImage
        if (finalEnv) {
            viewer.setAttribute('environment-image', finalEnv)
        }

        // Apply exposure from config directly (don't change for day/night)
        viewer.setAttribute('exposure', (config.exposure || 1.0).toString())

        // Apply shadow settings from config
        viewer.setAttribute('shadow-intensity', (config.shadowIntensity ?? 1).toString())
        viewer.setAttribute('shadow-softness', (config.shadowSoftness ?? 1).toString())

    }, [propBackgroundColor, environment, modelSlug])

    // Effect 4: Handle textureUrl changes independently
    useEffect(() => {
        const viewer = viewerElementRef.current
        // Only run if viewer is already loaded to avoid race conditions (handled in load listener otherwise)
        if (viewer && !loading && textureUrl) {
            applyTexture(viewer, textureUrl, modelSlug)
        } else if (viewer && !loading && !textureUrl) {
            // Logic to clear texture if needed (reset to original material colors/textures)
            // For now just keep last texture or reload model if required, but usually user clears texture by switching model
        }
    }, [textureUrl, modelSlug, loading])

    return (
        <div className={`relative ${className}`}>
            <div ref={containerRef} className="w-full h-full" />


            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm rounded-lg z-20">
                    <div className="w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
            )}

            {textureLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px] rounded-lg z-10 transition-all text-xs">
                    <div className="bg-white/80 px-4 py-2 rounded-full shadow-sm border border-gray-100 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-600 font-medium">{t('applying_texture')}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg z-20">
                    <div className="text-center text-red-600">
                        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="font-medium">{error}</p>
                    </div>
                </div>
            )}

            {!loading && !error && cameraControls && (
                // Control Tips - Top Right
                <div className="absolute top-4 right-4 bg-gray-800/80 backdrop-blur-sm text-white text-[10px] px-3 py-2 rounded-full shadow-lg pointer-events-none z-10 border border-white/10">
                    💡 {t('tips')}
                </div>
            )}
        </div>
    )
})
