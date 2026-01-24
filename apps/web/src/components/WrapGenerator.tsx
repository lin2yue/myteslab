'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'

interface GenerationHistory {
    id: string
    prompt: string
    modelSlug: string
    modelName: string
    imageDataUrl: string
    originalImageDataUrl?: string
    timestamp: number
}

interface WrapGeneratorProps {
    models: Array<{ slug: string; name: string }>
    onGenerated?: (result: { imageDataUrl: string; modelSlug: string }) => void
}

export function WrapGenerator({ models, onGenerated }: WrapGeneratorProps) {
    const [selectedModel, setSelectedModel] = useState(models[0]?.slug || '')
    const [prompt, setPrompt] = useState('')
    const [referenceImages, setReferenceImages] = useState<string[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [generatedImage, setGeneratedImage] = useState<string | null>(null)
    const [history, setHistory] = useState<GenerationHistory[]>([])
    const [debugMode, setDebugMode] = useState(true) // Default to true for debugging phase
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load history from localStorage on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('ai-wrap-history')
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory))
            } catch (e) {
                console.error('Failed to load history:', e)
            }
        }
    }, [])

    // Save history to localStorage
    const saveToHistory = useCallback((result: { imageDataUrl: string; originalImageDataUrl?: string; modelSlug: string }) => {
        const modelName = models.find(m => m.slug === result.modelSlug)?.name || result.modelSlug
        const newItem: GenerationHistory = {
            id: Date.now().toString(),
            prompt: prompt.trim(),
            modelSlug: result.modelSlug,
            modelName,
            imageDataUrl: result.imageDataUrl,
            originalImageDataUrl: result.originalImageDataUrl,
            timestamp: Date.now(),
        }

        setHistory(prev => {
            const updated = [newItem, ...prev].slice(0, 5) // Reduced from 20 to 5 to save space

            try {
                localStorage.setItem('ai-wrap-history', JSON.stringify(updated))
            } catch (e) {
                // Storage quota exceeded - try to save with fewer items
                console.warn('localStorage quota exceeded, reducing history size')
                try {
                    const reduced = [newItem, ...prev].slice(0, 2) // Keep only 2 items
                    localStorage.setItem('ai-wrap-history', JSON.stringify(reduced))
                    return reduced
                } catch (e2) {
                    // Still failing - clear history and save only current
                    console.error('Failed to save history, clearing old data')
                    localStorage.removeItem('ai-wrap-history')
                    localStorage.setItem('ai-wrap-history', JSON.stringify([newItem]))
                    return [newItem]
                }
            }

            return updated
        })
    }, [prompt, models])

    // Load from history
    const loadFromHistory = useCallback((item: GenerationHistory) => {
        setPrompt(item.prompt)
        setSelectedModel(item.modelSlug)
        setGeneratedImage(item.imageDataUrl)
        onGenerated?.({
            imageDataUrl: item.imageDataUrl,
            modelSlug: item.modelSlug,
        })
    }, [onGenerated])

    // Delete history item
    const deleteHistoryItem = useCallback((id: string) => {
        setHistory(prev => {
            const updated = prev.filter(item => item.id !== id)
            localStorage.setItem('ai-wrap-history', JSON.stringify(updated))
            return updated
        })
    }, [])

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        const newImages: string[] = []
        const maxImages = 3

        Array.from(files).slice(0, maxImages - referenceImages.length).forEach(file => {
            const reader = new FileReader()
            reader.onload = (event) => {
                if (event.target?.result) {
                    newImages.push(event.target.result as string)
                    if (newImages.length === Math.min(files.length, maxImages - referenceImages.length)) {
                        setReferenceImages(prev => [...prev, ...newImages].slice(0, maxImages))
                    }
                }
            }
            reader.readAsDataURL(file)
        })

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [referenceImages.length])

    const removeImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleGenerate = async () => {
        if (!selectedModel || !prompt.trim()) {
            setError('请选择车型并输入描述')
            return
        }

        setIsGenerating(true)
        setError(null)
        setGeneratedImage(null)

        try {
            const response = await fetch('/api/wrap/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    modelSlug: selectedModel,
                    prompt: prompt.trim(),
                    referenceImages: referenceImages,
                }),
            })

            const data = await response.json()

            if (!data.success) {
                throw new Error(data.error || '生成失败')
            }

            // 1. Get generation result (Original) - fully corrected by server
            const finalImageDataUrl = data.image.dataUrl;
            console.log('[WrapGenerator] Using final server-side corrected image');

            // 2. Save result to history and state
            const result = {
                imageDataUrl: finalImageDataUrl,
                originalImageDataUrl: finalImageDataUrl,
                modelSlug: selectedModel,
            };

            setGeneratedImage(result.imageDataUrl)
            saveToHistory(result)
            onGenerated?.({ imageDataUrl: result.imageDataUrl, modelSlug: selectedModel })
        } catch (err) {
            setError(err instanceof Error ? err.message : '生成失败，请重试')
        } finally {
            setIsGenerating(false)
        }
    }



    // Helper component for debug images
    const ImageWithInfo = ({ src, alt, label, onClick, isActive }: {
        src: string,
        alt: string,
        label: string,
        onClick?: (e: React.MouseEvent<HTMLDivElement>) => void,
        isActive?: boolean
    }) => {
        return (
            <div
                className={`comparison-item ${onClick ? 'clickable' : ''} ${isActive ? 'active' : ''}`}
                onClick={onClick}
            >
                <span className="comparison-label">{label} {onClick && '👆'}</span>
                <div style={{ position: 'relative' }}>
                    <Image
                        className="result-image"
                        src={src}
                        alt={alt}
                        fill
                        sizes="100vw"
                    />
                </div>
            </div>
        )
    }

    // Helper to get mask URL
    const getMaskUrl = (slug: string) => {
        const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
        const path = `/masks/${slug}_mask.png`;
        if (cdnUrl && !window.location.host.includes('localhost')) {
            return `${cdnUrl}${path}`;
        }
        return path;
    }

    return (
        <div className="wrap-generator">
            <style jsx>{`
                .wrap-generator {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 16px;
                    padding: 24px;
                    color: white;
                }
                .form-group { margin-bottom: 20px; }
                .label {
                    display: block;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #a0aec0;
                }
                .select-wrapper { position: relative; }
                .model-select {
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    appearance: none;
                }
                .model-select option { background: #1a1a2e; color: white; }
                .prompt-input {
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    color: white;
                    font-size: 16px;
                    min-height: 100px;
                    resize: vertical;
                }
                .image-upload-area {
                    border: 2px dashed rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .image-upload-area:hover {
                    border-color: #667eea;
                    background: rgba(102, 126, 234, 0.1);
                }
                .reference-images {
                    display: flex;
                    gap: 12px;
                    margin-top: 12px;
                    flex-wrap: wrap;
                }
                .reference-image {
                    position: relative;
                    width: 80px;
                    height: 80px;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .reference-image img { width: 100%; height: 100%; object-fit: cover; }
                .remove-image {
                    position: absolute; top: 4px; right: 4px;
                    width: 20px; height: 20px;
                    background: rgba(0, 0, 0, 0.7);
                    border: none; border-radius: 50%; color: white;
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                }
                .generate-btn {
                    width: 100%;
                    padding: 16px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none; border-radius: 8px; color: white;
                    font-size: 16px; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    transition: all 0.3s ease;
                }
                .generate-btn:hover:not(:disabled) { transform: translateY(-2px); }
                .generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .spinner {
                    width: 20px; height: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .error-message {
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.5);
                    border-radius: 8px; padding: 12px 16px; color: #fca5a5; margin-bottom: 16px;
                }
                .generated-result {
                    margin-top: 24px; padding: 16px;
                    background: rgba(255, 255, 255, 0.05); border-radius: 12px;
                }
                .result-title {
                    font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #10b981;
                }
                .result-image {
                    width: 100%;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    object-fit: contain; /* Correct aspect ratio */
                    background: #000;
                    aspect-ratio: 4/3;
                }
                .history-section {
                    margin-top: 24px; padding-top: 24px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }
                .history-header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
                }
                .history-list {
                    display: flex; flex-direction: column; gap: 12px;
                    max-height: 600px; overflow-y: auto;
                }
                .history-item {
                    display: flex; flex-direction: column; gap: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px; padding: 12px;
                }
                .history-info { flex: 1; }
                .history-prompt { 
                    font-size: 14px; color: #e2e8f0; margin-bottom: 8px;
                    overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
                    -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                }
                .history-meta { display: flex; gap: 12px; font-size: 12px; color: #a0aec0; }
                .history-delete {
                    align-self: flex-end;
                    background: transparent; border: none; color: #ef4444; cursor: pointer;
                }
                .debug-toggle {
                    margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
                    color: #a0aec0; font-size: 14px; cursor: pointer;
                }
                .debug-comparison {
                    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 16px;
                }
                .comparison-item { 
                    display: flex; flex-direction: column; gap: 8px; 
                    border: 1px solid transparent; /* Default border */
                    border-radius: 8px;
                    padding: 4px;
                }
                .comparison-item.clickable {
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .comparison-item.clickable:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                .comparison-item.active {
                    border-color: #10b981; /* Highlight active image */
                    background: rgba(16, 185, 129, 0.1);
                }
                .comparison-label { font-size: 12px; color: #a0aec0; text-align: center; }
                .resolution-tag {
                    position: absolute;
                    bottom: 4px; right: 4px;
                    background: rgba(0,0,0,0.7);
                    color: #00ff00;
                    font-size: 10px;
                    padding: 2px 4px;
                    border-radius: 4px;
                    font-family: monospace;
                    pointer-events: none;
                }
            `}</style>

            <div className="debug-toggle" onClick={() => setDebugMode(!debugMode)}>
                <input type="checkbox" checked={debugMode} readOnly />
                <span>启用调试模式 (显示原始图、Mask、分辨率)</span>
            </div>

            <div className="form-group">
                <label className="label">选择车型</label>
                <div className="select-wrapper">
                    <select
                        className="model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        {models.map((model) => (
                            <option key={model.slug} value={model.slug}>{model.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="form-group">
                <label className="label">设计描述</label>
                <textarea
                    className="prompt-input"
                    placeholder="描述你想要的贴膜设计..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label className="label">参考图片（可选）</label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                />
                <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                    <div className="upload-icon">📷</div>
                    <div className="upload-text">点击上传参考图片</div>
                </div>
                {referenceImages.length > 0 && (
                    <div className="reference-images">
                        {referenceImages.map((img, index) => (
                            <div key={index} className="reference-image">
                                <Image src={img} alt={`Ref ${index + 1}`} fill sizes="100vw" />
                                <button className="remove-image" onClick={() => removeImage(index)}>×</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && <div className="error-message">⚠️ {error}</div>}

            <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
            >
                {isGenerating ? (
                    <><div className="spinner" /> 生成中... (约 20 秒)</>
                ) : (
                    <>✨ 生成贴膜设计</>
                )}
            </button>

            {generatedImage && (
                <div className="generated-result">
                    <div className="result-title">✅ 生成完成</div>
                    {debugMode && history[0]?.originalImageDataUrl && history[0]?.id === history.find(h => h.imageDataUrl === generatedImage)?.id ? (
                        <div className="debug-comparison">
                            <ImageWithInfo
                                src={history.find(h => h.imageDataUrl === generatedImage)?.originalImageDataUrl || generatedImage}
                                alt="Raw"
                                label="🔴 原始 (Raw)"
                                onClick={() => onGenerated?.({
                                    imageDataUrl: history.find(h => h.imageDataUrl === generatedImage)?.originalImageDataUrl || generatedImage || '',
                                    modelSlug: selectedModel
                                })}
                            />
                            <ImageWithInfo
                                src={getMaskUrl(selectedModel)}
                                alt="Mask"
                                label="🟣 遮罩 (Mask)"
                            />
                            <ImageWithInfo
                                src={generatedImage}
                                alt="Processed"
                                label="🟢 最终 (Final)"
                                onClick={() => onGenerated?.({ imageDataUrl: generatedImage, modelSlug: selectedModel })}
                                isActive={true}
                            />
                        </div>
                    ) : (
                        <Image
                            className="result-image"
                            src={generatedImage}
                            alt="生成的贴膜设计"
                            fill
                            sizes="100vw"
                            priority
                        />
                    )}
                </div>
            )}

            {/* History Section (Modified for Debug) */}
            {history.length > 0 && (
                <div className="history-section">
                    <div className="history-header">
                        <h3 className="history-title">📜 生成历史 {debugMode ? '(调试模式)' : ''}</h3>
                        <span className="history-count">{history.length} 条记录</span>
                    </div>
                    <div className="history-list">
                        {history.map((item) => (
                            <div key={item.id} className="history-item" style={{ flexDirection: 'column' }}>
                                <div className="history-info">
                                    <div className="history-prompt">{item.prompt}</div>
                                    <div className="history-meta">
                                        <span className="history-model">🚗 {item.modelName}</span>
                                        <span className="history-time">
                                            {new Date(item.timestamp).toLocaleString('zh-CN', {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>

                                {debugMode ? (
                                    <div className="debug-comparison" style={{ marginTop: 8 }}>
                                        <ImageWithInfo
                                            src={item.originalImageDataUrl || item.imageDataUrl}
                                            alt="Raw"
                                            label="原始"
                                            onClick={(e) => {
                                                e?.stopPropagation(); // Prevent parent click
                                                onGenerated?.({ imageDataUrl: item.originalImageDataUrl || item.imageDataUrl, modelSlug: item.modelSlug });
                                                setGeneratedImage(item.imageDataUrl); // Update main view
                                            }}
                                        />
                                        <ImageWithInfo
                                            src={getMaskUrl(item.modelSlug)}
                                            alt="Mask"
                                            label="遮罩"
                                        />
                                        <ImageWithInfo
                                            src={item.imageDataUrl}
                                            alt="Processed"
                                            label="修正后"
                                            onClick={(e) => {
                                                e?.stopPropagation();
                                                onGenerated?.({ imageDataUrl: item.imageDataUrl, modelSlug: item.modelSlug });
                                                setGeneratedImage(item.imageDataUrl);
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="history-thumbnail" onClick={() => loadFromHistory(item)}>
                                        <Image src={item.imageDataUrl} alt={item.prompt} fill sizes="100vw" />
                                    </div>
                                )}

                                <button className="history-delete" onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}>×</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}    </div>
    )
}
