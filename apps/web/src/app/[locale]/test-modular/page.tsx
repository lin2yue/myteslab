'use client'

import { useState } from 'react'
import { ModelViewerClient } from '@/components/ModelViewerClient'

export default function TestModularPage() {
    const [selectedModel, setSelectedModel] = useState('modely-2025-premium')
    const [selectedWheel, setSelectedWheel] = useState('modely-2025-premium')

    const models = [
        { id: 'modely-2025-premium', name: 'Model Y 2025 Premium' },
        { id: 'model3-2024-base', name: 'Model 3 2024 Base' },
        { id: 'cybertruck', name: 'Cybertruck' }
    ]

    const wheels = [
        { id: 'modely-2025-premium', name: 'Premium Wheels' },
        { id: 'shared_wheels_induction', name: 'Induction Wheels (Shared)' },
        { id: 'shared_wheels_stiletto', name: 'Stiletto Wheels (Shared)' }
    ]

    const bodyUrl = `/models-test/${selectedModel}/body.glb`
    const wheelUrl = `/models-test/${selectedWheel}/${selectedWheel.includes('shared') ? 'body.glb' : 'wheels.glb'}`

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Modular Model Loading Test</h1>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                    <label className="block text-sm font-medium mb-1">Select Body</label>
                    <select
                        className="w-full p-2 border rounded"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Select Wheels</label>
                    <select
                        className="w-full p-2 border rounded"
                        value={selectedWheel}
                        onChange={(e) => setSelectedWheel(e.target.value)}
                    >
                        {wheels.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden border">
                <ModelViewerClient
                    modelUrl={bodyUrl}
                    wheelUrl={wheelUrl}
                    autoRotate
                    className="w-full h-full"
                />
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded text-xs font-mono">
                <p>Body URL: {bodyUrl}</p>
                <p>Wheel URL: {wheelUrl}</p>
            </div>
        </div>
    )
}
