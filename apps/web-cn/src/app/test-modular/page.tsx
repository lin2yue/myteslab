'use client'

import { useState } from 'react'
import { ModelViewerClient } from '@/components/ModelViewerClient'
import { DEFAULT_MODELS } from '@/config/models'

export default function TestModularPage() {
    const [selectedModelSlug, setSelectedModelSlug] = useState(DEFAULT_MODELS[0].slug)
    const [selectedWheelUrl, setSelectedWheelUrl] = useState(DEFAULT_MODELS[0].wheel_url)

    // Extract unique wheels from config for the dropdown
    const uniqueWheels = Array.from(new Set(DEFAULT_MODELS.map(m => m.wheel_url).filter(Boolean)))
        .map(url => {
            const model = DEFAULT_MODELS.find(m => m.wheel_url === url)
            return {
                url: url!,
                name: model?.name + ' Wheels' || 'Unknown Wheels'
            }
        })

    const selectedModel = DEFAULT_MODELS.find(m => m.slug === selectedModelSlug) || DEFAULT_MODELS[0]

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Modular Model Loading Test</h1>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                    <label className="block text-sm font-medium mb-1">Select Body</label>
                    <select
                        className="w-full p-2 border rounded"
                        value={selectedModelSlug}
                        onChange={(e) => {
                            const newSlug = e.target.value
                            setSelectedModelSlug(newSlug)
                            // Auto-select corresponding wheel for convenience, but allow override
                            const newModel = DEFAULT_MODELS.find(m => m.slug === newSlug)
                            if (newModel?.wheel_url) {
                                setSelectedWheelUrl(newModel.wheel_url)
                            }
                        }}
                    >
                        {DEFAULT_MODELS.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Select Wheels</label>
                    <select
                        className="w-full p-2 border rounded"
                        value={selectedWheelUrl}
                        onChange={(e) => setSelectedWheelUrl(e.target.value || undefined)}
                    >
                        {uniqueWheels.map(w => <option key={w.url} value={w.url}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden border">
                <ModelViewerClient
                    modelUrl={selectedModel.model_3d_url}
                    wheelUrl={selectedWheelUrl}
                    modelSlug={selectedModelSlug}
                    autoRotate
                    className="w-full h-full"
                />
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded text-xs font-mono">
                <p>Body URL: {selectedModel.model_3d_url}</p>
                <p>Wheel URL: {selectedWheelUrl}</p>
            </div>
        </div>
    )
}
