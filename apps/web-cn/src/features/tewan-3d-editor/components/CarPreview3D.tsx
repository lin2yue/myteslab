'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { getMaterialRuleByModel } from '../config/material-map'

export type MaterialDecision = {
  meshName: string
  materialName: string
  target: string
  decision: 'included' | 'excluded'
  reason: string
}

type CarModelProps = {
  modelUrl: string
  modelSlug: string
  textureDataUrl: string | null
  lightingMode?: 'day' | 'night'
  onMaterialDecisions?: (decisions: MaterialDecision[]) => void
}

function decideTextureMapping(meshName: string, materialName: string, modelSlug: string): MaterialDecision {
  const rule = getMaterialRuleByModel(modelSlug)
  const normalizedMaterial = materialName.toLowerCase().trim()
  const target = `${meshName} ${materialName}`.toLowerCase()

  if (rule.excludeKeywords.some((k) => target.includes(k))) {
    return { meshName, materialName, target, decision: 'excluded', reason: 'matched exclude keyword' }
  }
  if (rule.includeExact.includes(normalizedMaterial)) {
    return { meshName, materialName, target, decision: 'included', reason: 'matched include exact' }
  }
  if (rule.includeKeywords.some((k) => target.includes(k))) {
    return { meshName, materialName, target, decision: 'included', reason: 'matched include keyword' }
  }
  if (normalizedMaterial === '') {
    return { meshName, materialName, target, decision: 'included', reason: 'empty material name fallback' }
  }
  return { meshName, materialName, target, decision: 'excluded', reason: 'not matched include rules' }
}

function CarModel({ modelUrl, modelSlug, textureDataUrl, onMaterialDecisions }: CarModelProps) {
  const gltf = useLoader(GLTFLoader, modelUrl)

  const texture = useMemo(() => {
    if (!textureDataUrl) return null
    const t = new THREE.TextureLoader().load(textureDataUrl)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = false
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 1)
    t.offset.set(0, 0)
    t.needsUpdate = true
    return t
  }, [textureDataUrl])

  useEffect(() => {
    if (!gltf?.scene || !texture) return

    const decisions: MaterialDecision[] = []
    gltf.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.material) return

      const applyToMaterial = (m: THREE.MeshStandardMaterial) => {
        const materialName = (m.name || '').toLowerCase()
        const meshName = (obj.name || '').toLowerCase()
        const decision = decideTextureMapping(meshName, materialName, modelSlug)
        decisions.push(decision)
        if (decision.decision !== 'included') return m

        const cloned = m.clone()
        cloned.map = texture
        cloned.needsUpdate = true
        return cloned
      }

      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => applyToMaterial(m as THREE.MeshStandardMaterial))
      } else {
        obj.material = applyToMaterial(obj.material as THREE.MeshStandardMaterial)
      }
    })

    if (onMaterialDecisions) {
      const deduped = new Map<string, MaterialDecision>()
      decisions.forEach((item) => {
        const key = `${item.meshName}|${item.materialName}|${item.decision}`
        if (!deduped.has(key)) deduped.set(key, item)
      })
      onMaterialDecisions(Array.from(deduped.values()))
    }
  }, [gltf, texture, modelSlug, onMaterialDecisions])

  return <primitive object={gltf.scene} scale={1} />
}

export function CarPreview3D({ modelUrl, modelSlug, textureDataUrl, lightingMode = 'day', onMaterialDecisions }: CarModelProps) {
  const isNight = lightingMode === 'night'

  return (
    <div className="h-full w-full overflow-hidden bg-black">
      <Canvas camera={{ position: [4, 2, 6], fov: 40 }}>
        <color attach="background" args={[isNight ? '#030712' : '#dbeafe']} />
        <ambientLight intensity={isNight ? 0.5 : 1.0} color={isNight ? '#9cc3ff' : '#ffffff'} />
        <directionalLight position={[5, 8, 5]} intensity={isNight ? 0.8 : 1.35} color={isNight ? '#7dd3fc' : '#ffffff'} />
        <directionalLight position={[-4, 6, -3]} intensity={isNight ? 0.28 : 0.4} color={isNight ? '#60a5fa' : '#fff7ed'} />

        <Suspense fallback={null}>
          <CarModel
            modelUrl={modelUrl}
            modelSlug={modelSlug}
            textureDataUrl={textureDataUrl}
            onMaterialDecisions={onMaterialDecisions}
          />
          <Environment preset={isNight ? 'night' : 'city'} />
        </Suspense>

        <OrbitControls enablePan={false} minDistance={2} maxDistance={14} />
      </Canvas>
    </div>
  )
}
