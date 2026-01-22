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
    ignoreConfigRotation?: boolean
}

export interface ModelViewerRef {
    takeHighResScreenshot: () => Promise<string | null>
}

export const ModelViewer = forwardRef<ModelViewerRef, ModelViewerProps>(({
    modelUrl,
    textureUrl,
    modelSlug,
    className = '',
    id,
    autoRotate: propAutoRotate,
    environment = 'neutral',
    backgroundColor,
    ignoreConfigRotation = false
}, ref) => {
    const t = useTranslations('Common')
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerElementRef = useRef<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [textureLoading, setTextureLoading] = useState(false)

    useImperativeHandle(ref, () => ({
        takeHighResScreenshot: async () => {
            const viewer = viewerElementRef.current;
            if (!viewer) return null;

            // 1. 记录原始状态
            const originalWidth = viewer.style.width;
            const originalHeight = viewer.style.height;
            const originalMinRenderScale = viewer.getAttribute('min-render-scale');

            try {
                // 2. 临时提升质量
                viewer.setAttribute('min-render-scale', '1');

                // 3. 等待渲染队列清空 (确保尺寸调整和纹理应用完成)
                // 注意：不再将元素移出视口，因为部分浏览器在元素不在视口内时会停止渲染导致黑屏
                await new Promise(resolve => requestAnimationFrame(resolve));
                await new Promise(resolve => requestAnimationFrame(resolve));
                await new Promise(resolve => setTimeout(resolve, 300)); // 给 GPU 渲染缓冲时间

                // 4. 捕捉截图 (使用 model-viewer 的 toBlob 更加稳定)
                const blob = await viewer.toBlob({
                    mimeType: 'image/jpeg',
                    qualityArgument: 0.9,
                    idealAspect: true
                });

                if (!blob) return null;

                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });

            } finally {
                // 5. 还原状态
                if (originalMinRenderScale) {
                    viewer.setAttribute('min-render-scale', originalMinRenderScale);
                } else {
                    viewer.removeAttribute('min-render-scale');
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
        try {
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

                // Only apply rotation/mirror logic if NOT ignored (e.g., in DIY mode)
                if (!ignoreConfigRotation) {
                    if (config.rotation !== undefined) {
                        threeTexture.rotation = (config.rotation * Math.PI) / 180
                    }
                    if (config.scale !== undefined) {
                        const scaleX = config.mirror ? -config.scale : config.scale
                        threeTexture.repeat.set(scaleX, config.scale)
                    }
                } else {
                    // Reset to defaults for DIY
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
        } catch (err) {
            console.error('Failed to apply texture:', err)
        } finally {
            setTextureLoading(false)
        }
    }

    // Effect 1: Handle model element creation and modelUrl changes
    useEffect(() => {
        import('@google/model-viewer')
        if (!containerRef.current) return

        setLoading(true)
        setError(null)

        const viewer = document.createElement('model-viewer') as any
        if (id) viewer.id = id
        viewerElementRef.current = viewer

        const config = {
            ...viewerConfig.defaults,
            ...(modelSlug && (viewerConfig.models as any)[modelSlug] ? (viewerConfig.models as any)[modelSlug] : {})
        }

        viewer.setAttribute('src', modelUrl)
        viewer.setAttribute('camera-controls', 'true')
        viewer.setAttribute('touch-action', 'pan-y')
        viewer.setAttribute('interaction-prompt', config.interactionPrompt || 'none')
        viewer.setAttribute('camera-orbit', config.cameraOrbit)
        viewer.setAttribute('field-of-view', config.fieldOfView)
        viewer.setAttribute('environment-image', environment || config.environmentImage)
        viewer.setAttribute('shadow-intensity', config.shadowIntensity.toString())
        viewer.setAttribute('shadow-softness', config.shadowSoftness.toString())
        viewer.setAttribute('exposure', config.exposure.toString())
        viewer.style.width = '100%'
        viewer.style.height = '100%'
        if (backgroundColor) viewer.style.backgroundColor = backgroundColor

        const onLoad = async () => {
            setLoading(false)
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

    // Effect 3: Update appearance (background, environment) without reload
    useEffect(() => {
        const viewer = viewerElementRef.current
        if (!viewer) return

        if (backgroundColor) {
            viewer.style.backgroundColor = backgroundColor
        }

        const config = {
            ...viewerConfig.defaults,
            ...(modelSlug && (viewerConfig.models as any)[modelSlug] ? (viewerConfig.models as any)[modelSlug] : {})
        }
        const finalEnv = environment || config.environmentImage
        if (finalEnv) {
            viewer.setAttribute('environment-image', finalEnv)
        }
    }, [backgroundColor, environment, modelSlug])

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
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-20">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600 font-medium">{t('loading_model')}</p>
                    </div>
                </div>
            )}

            {textureLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] rounded-lg z-10 transition-all">
                    <div className="bg-white/90 px-6 py-4 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-700 font-semibold text-sm">{t('applying_texture')}</p>
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

            {!loading && !error && (
                // Control Tips - Top Right
                <div className="absolute top-4 right-4 bg-gray-800/80 backdrop-blur-sm text-white text-[10px] px-3 py-2 rounded-full shadow-lg pointer-events-none z-10 border border-white/10">
                    💡 {t('tips')}
                </div>
            )}
        </div>
    )
})

