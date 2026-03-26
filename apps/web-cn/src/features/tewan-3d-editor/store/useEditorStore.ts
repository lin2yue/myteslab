'use client'

import { create } from 'zustand'

type ToolType = 'paint' | 'shape' | 'text' | 'sticker'
type ShapeType = 'rect' | 'circle' | 'line'
type MaterialFinish = 'matte' | 'gloss'
type LightingMode = 'day' | 'garage'

type EditorState = {
  tool: ToolType
  shapeType: ShapeType
  color: string
  brushSize: number
  fontSize: number
  fontFamily: string
  textureDataUrl: string | null
  materialFinish: MaterialFinish
  lightingMode: LightingMode
  /** 与 AI 设计页一致：默认开启自动旋转 */
  autoRotate: boolean
  setTool: (tool: ToolType) => void
  setShapeType: (shape: ShapeType) => void
  setColor: (color: string) => void
  setBrushSize: (size: number) => void
  setFontSize: (size: number) => void
  setFontFamily: (font: string) => void
  setTextureDataUrl: (dataUrl: string) => void
  setMaterialFinish: (finish: MaterialFinish) => void
  setLightingMode: (mode: LightingMode) => void
  setAutoRotate: (on: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'paint',
  shapeType: 'rect',
  color: '#ff2d55',
  brushSize: 12,
  fontSize: 68,
  fontFamily: 'Inter',
  textureDataUrl: null,
  materialFinish: 'gloss',
  lightingMode: 'day',
  autoRotate: true,
  setTool: (tool) => set({ tool }),
  setShapeType: (shapeType) => set({ shapeType }),
  setColor: (color) => set({ color }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setTextureDataUrl: (textureDataUrl) => set({ textureDataUrl }),
  setMaterialFinish: (materialFinish) => set({ materialFinish }),
  setLightingMode: (lightingMode) => set({ lightingMode }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
}))
