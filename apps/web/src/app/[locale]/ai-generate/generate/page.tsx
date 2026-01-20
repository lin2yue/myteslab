'use client'

import { useState } from 'react'
import { WrapGenerator } from '@/components/WrapGenerator'
import { ModelViewer } from '@/components/ModelViewer'

// Available models
const MODELS = [
    { slug: 'cybertruck', name: 'Cybertruck', modelUrl: '/models/Cybertruck/cybertruck.glb' },
    { slug: 'model-3', name: 'Model 3', modelUrl: '/models/model-3/model_3.glb' },
    { slug: 'model-3-2024-plus', name: 'Model 3 2024+', modelUrl: '/models/model-3-2024-plus/model_3_2024plus.glb' },
    { slug: 'model-y-pre-2025', name: 'Model Y', modelUrl: '/models/model-y-pre-2025/model_v2.glb' },
    { slug: 'model-y-2025-plus', name: 'Model Y 2025+', modelUrl: '/models/model-y-2025-plus/model_y_2025plus.glb' },
]

export default function GeneratePage() {
    const [generatedTexture, setGeneratedTexture] = useState<string | null>(null)
    const [selectedModelSlug, setSelectedModelSlug] = useState<string>('cybertruck')

    const selectedModel = MODELS.find(m => m.slug === selectedModelSlug) || MODELS[0]

    const handleGenerated = (result: { imageDataUrl: string; modelSlug: string }) => {
        setGeneratedTexture(result.imageDataUrl)
        setSelectedModelSlug(result.modelSlug)
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
            padding: '24px',
        }}>
            <style jsx global>{`
                * {
                    box-sizing: border-box;
                }
                
                .page-container {
                    max-width: 1400px;
                    margin: 0 auto;
                }
                
                .page-header {
                    text-align: center;
                    margin-bottom: 32px;
                }
                
                .page-title {
                    font-size: 36px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin: 0 0 8px 0;
                }
                
                .page-subtitle {
                    color: #a0aec0;
                    font-size: 16px;
                    margin: 0;
                }
                
                .content-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }
                
                @media (max-width: 1024px) {
                    .content-grid {
                        grid-template-columns: 1fr;
                    }
                }
                
                .preview-section {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 16px;
                    padding: 24px;
                    min-height: 500px;
                }
                
                .preview-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #e2e8f0;
                    margin: 0 0 16px 0;
                }
                
                .model-viewer-container {
                    height: 450px;
                    background: radial-gradient(ellipse at center, #2d3748 0%, #1a202c 100%);
                    border-radius: 12px;
                    overflow: hidden;
                }
                
                .no-texture-hint {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #718096;
                    text-align: center;
                }
                
                .no-texture-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }
                
                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #667eea;
                    text-decoration: none;
                    margin-bottom: 24px;
                    font-size: 14px;
                }
                
                .back-link:hover {
                    text-decoration: underline;
                }
            `}</style>

            <div className="page-container">
                <a href="/" className="back-link">
                    ← 返回首页
                </a>

                <header className="page-header">
                    <h1 className="page-title">✨ AI Wrap Generator</h1>
                    <p className="page-subtitle">使用 AI 生成独特的 Tesla 车身贴膜设计</p>
                </header>

                <div className="content-grid">
                    {/* Left: Generator Form */}
                    <div>
                        <WrapGenerator
                            models={MODELS.map(m => ({ slug: m.slug, name: m.name }))}
                            onGenerated={handleGenerated}
                        />
                    </div>

                    {/* Right: 3D Preview */}
                    <div className="preview-section">
                        <h2 className="preview-title">
                            🚗 3D 实时预览 - {selectedModel.name}
                        </h2>
                        <div className="model-viewer-container">
                            {generatedTexture ? (
                                <ModelViewer
                                    modelUrl={selectedModel.modelUrl}
                                    textureUrl={generatedTexture}
                                    modelSlug={selectedModelSlug}
                                    className="w-full h-full"
                                />
                            ) : (
                                <div className="no-texture-hint">
                                    <div className="no-texture-icon">🎨</div>
                                    <p>生成贴膜后将在这里显示 3D 预览</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
