'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { useTranslations } from 'next-intl'

import viewerConfig from '@/config/viewer-config.json'

interface ModelViewerProps {
    modelUrl: string
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
                else viewer.removeAttribute('exposure');

                // Restore Style
                viewer.style.backgroundColor = originalBG;

                if (typeof viewer.jumpCameraToGoal === 'function') {
                    viewer.jumpCameraToGoal();
                }
            }
        }
    }));

    // 获取 Three.js 场景的助手函数
    const getThreeScene = (viewer: any) => {
        try {
            const sceneSymbol = Object.getOwnPropertySymbols(viewer).find((s) => s.description === 'scene')
            return sceneSymbol ? viewer[sceneSymbol] : null
        } catch {
            return null
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
                            }
                        } catch (e) {
                            console.warn(`Model Viewer API 设置材质 ${name} 失败:`, e)
                        }
                    }
                })

                // 2. Through Three.js adjustment
                const threeTexture = (texture as any).source?.texture || (texture as any).texture
                if (threeTexture) {
                    threeTexture.center.set(0.5, 0.5)

                    // Standardize dynamic texture application:
                    // Trust that provided textureUrl is already standardized (Heading Up/Left) 
                    // and skip legacy model-specific rotation offsets.
                    if (false) { // Keep structure but disable the skip for now to see if we can just fix it via config
                        if (config.rotation !== undefined) {
                            threeTexture.rotation = (config.rotation * Math.PI) / 180
                        }
                        if (config.scale !== undefined) {
                            const scaleX = config.mirror ? -config.scale : config.scale
                            threeTexture.repeat.set(scaleX, config.scale)
                        }
                    } else {
                        // Reset to defaults (no transformation) for standardized dynamic assets
                        threeTexture.rotation = 0
                        threeTexture.repeat.set(1, 1)
                    }

                    threeTexture.wrapS = 1000 // RepeatWrapping
                    threeTexture.wrapT = 1000 // RepeatWrapping
                    threeTexture.flipY = false
                    threeTexture.needsUpdate = true
                }

                // 3. Three.js fallback
                const scene = getThreeScene(viewer)
                if (scene) {
                    scene.traverse((node: any) => {
                        if (node.isMesh && node.material) {
                            const mats = Array.isArray(node.material) ? node.material : [node.material]
                            mats.forEach((m: any) => {
                                const name = m.name?.toLowerCase() || ''
                                const isBody = name === '' ||
                                    name.includes('paint') ||
                                    name.includes('body') ||
                                    name.includes('exterior') ||
                                    name.includes('stainless') ||
                                    name === 'ext_body'

                                if (isBody) {
                                    if (threeTexture) {
                                        m.map = threeTexture
                                        m.color.setRGB(1, 1, 1)
                                    }
                                    m.side = 2
                                    m.needsUpdate = true
                                }
                            })
                        }
                    })
                }

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
            setLoading(false)
            modelLoadedRef.current = true
            // UV Map logic
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
                const targetUV = config.uvSet === 'uv1' || (config.uvSet === undefined && availableUVs.includes('uv1')) ? 'uv1' : 'uv'
                if (targetUV !== 'uv') {
                    scene.traverse((node: any) => {
                        if (node.isMesh && node.geometry) {
                            const geom = node.geometry
                            if (geom.attributes[targetUV]) {
                                if (!geom.userData.originalUV) geom.userData.originalUV = geom.attributes.uv
                                geom.attributes.uv = geom.attributes[targetUV]
                                geom.attributes.uv.needsUpdate = true
                            }
                        }
                    })
                }
            }
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
    }, [modelUrl, id]) // Re-run only on core model identity change

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

        // Apply exposure based on day/night or config
        // If background is dark (night mode), reduce exposure
        const isNightMode = propBackgroundColor === '#1F1F1F'
        const exposureBalance = isNightMode ? 0.6 : (config.exposure || 1.0)
        viewer.setAttribute('exposure', exposureBalance.toString())

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

