'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import viewerConfig from '@/config/viewer-config.json'

interface ModelViewerProps {
    modelUrl: string
    textureUrl?: string
    modelSlug?: string
    className?: string
}

export function ModelViewer({ modelUrl, textureUrl, modelSlug, className = '' }: ModelViewerProps) {
    const t = useTranslations('Common')
    const containerRef = useRef<HTMLDivElement>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // 动态导入 model-viewer 以避免 SSR 错误
        import('@google/model-viewer')

        if (!containerRef.current) return

        const viewer = document.createElement('model-viewer') as any

        // 获取特定车型配置或使用默认配置
        const config = {
            ...viewerConfig.defaults,
            ...(modelSlug && (viewerConfig.models as any)[modelSlug] ? (viewerConfig.models as any)[modelSlug] : {})
        }

        // 基础配置
        viewer.setAttribute('src', modelUrl)
        viewer.setAttribute('camera-controls', 'true')
        viewer.setAttribute('touch-action', 'pan-y')
        viewer.setAttribute('interaction-prompt', config.interactionPrompt || 'none')
        viewer.setAttribute('auto-rotate', config.autoRotate ? 'true' : 'false')

        // 渲染配置
        viewer.setAttribute('camera-orbit', config.cameraOrbit)
        viewer.setAttribute('field-of-view', config.fieldOfView)
        viewer.setAttribute('environment-image', config.environmentImage)
        viewer.setAttribute('shadow-intensity', config.shadowIntensity.toString())
        viewer.setAttribute('shadow-softness', config.shadowSoftness.toString())
        viewer.setAttribute('exposure', config.exposure.toString())

        // 样式
        viewer.style.width = '100%'
        viewer.style.height = '100%'

        // 获取 Three.js 场景的助手函数
        const getThreeScene = () => {
            try {
                const sceneSymbol = Object.getOwnPropertySymbols(viewer).find((s) => s.description === 'scene')
                return sceneSymbol ? viewer[sceneSymbol] : null
            } catch {
                return null
            }
        }

        // 加载完成事件
        viewer.addEventListener('load', async () => {
            setLoading(false)

            const config = {
                ...viewerConfig.defaults,
                ...(modelSlug && (viewerConfig.models as any)[modelSlug] ? (viewerConfig.models as any)[modelSlug] : {})
            }

            const scene = getThreeScene()
            if (scene) {
                // UV Map 优先逻辑: 如果模型包含 uv1 (UVMap.001), 则优先使用它
                // 这在特斯拉车型的异步拆解中非常常见, 以支持非对称贴图
                let availableUVs = ['uv']
                scene.traverse((node: any) => {
                    if (node.isMesh && node.geometry && availableUVs.length === 1) {
                        if (node.geometry.attributes.uv1) availableUVs.push('uv1')
                    }
                })

                // 优先使用 uv1 (Unique UVs)
                const targetUV = config.uvSet === 'uv1' || (config.uvSet === undefined && availableUVs.includes('uv1')) ? 'uv1' : 'uv'

                if (targetUV !== 'uv') {
                    scene.traverse((node: any) => {
                        if (node.isMesh && node.geometry) {
                            const geom = node.geometry
                            if (geom.attributes[targetUV]) {
                                // 交换 UV 属性，使得所有默认使用 UV 的贴图都映射到 targetUV
                                geom.attributes.uv = geom.attributes[targetUV]
                                geom.attributes.uv.needsUpdate = true
                            }
                        }
                    })
                }

                // 应用贴纸纹理
                if (textureUrl) {
                    try {
                        const texture = await viewer.createTexture(textureUrl)
                        const materials = viewer.model.materials

                        // 1. 通过 Model Viewer API 设置纹理 (基础步骤)
                        materials.forEach((material: any) => {
                            const name = material.name?.toLowerCase() || ''
                            // 匹配车身材质
                            if (name.includes('paint') || name.includes('body') || name.includes('exterior') || name.includes('stainless')) {
                                material.pbrMetallicRoughness.baseColorTexture.setTexture(texture)
                            }
                        })

                        // 2. 通过 Three.js 直接调整纹理参数 (高级步骤)
                        // 这部分逻辑同步自 tweak.html, 用于处理 scale/rotation/mirror
                        const threeTexture = (texture as any).source?.texture || (texture as any).texture
                        if (threeTexture) {
                            threeTexture.center.set(0.5, 0.5)
                            if (config.rotation !== undefined) {
                                threeTexture.rotation = (config.rotation * Math.PI) / 180
                            }
                            if (config.scale !== undefined) {
                                const scaleX = config.mirror ? -config.scale : config.scale
                                threeTexture.repeat.set(scaleX, config.scale)
                            }
                            threeTexture.wrapS = 1000 // RepeatWrapping
                            threeTexture.wrapT = 1000 // RepeatWrapping
                            threeTexture.flipY = false
                            threeTexture.needsUpdate = true
                        }

                        // 3. 确保材质属性 (双面渲染等)
                        scene.traverse((node: any) => {
                            if (node.isMesh && node.material) {
                                const mats = Array.isArray(node.material) ? node.material : [node.material]
                                mats.forEach((m: any) => {
                                    const name = m.name?.toLowerCase() || ''
                                    if (name.includes('paint') || name.includes('body') || name.includes('exterior') || name.includes('stainless')) {
                                        m.side = 2 // DoubleSide
                                        m.needsUpdate = true
                                    }
                                })
                            }
                        })
                    } catch (err) {
                        console.error('应用纹理失败:', err)
                    }
                }
            }
        })

        // 错误处理
        viewer.addEventListener('error', (event: any) => {
            console.error('模型加载失败:', event)
            setError(t('model_error'))
            setLoading(false)
        })

        containerRef.current.appendChild(viewer)

        return () => {
            viewer.remove()
        }
    }, [modelUrl, textureUrl])

    return (
        <div className={`relative ${className}`}>
            <div ref={containerRef} className="w-full h-full" />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600">{t('loading_model')}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg">
                    <div className="text-center text-red-600">
                        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {!loading && !error && (
                // Control Tips - Top Right
                <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none z-10">
                    💡 {t('tips')}
                </div>
            )}
        </div>
    )
}
