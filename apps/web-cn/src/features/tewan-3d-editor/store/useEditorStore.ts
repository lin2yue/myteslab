'use client'

import { create } from 'zustand'

type ToolType = 'select' | 'paint' | 'erase' | 'shape' | 'text' | 'sticker'
type ShapeType = 'rect' | 'circle' | 'line'
type MaterialFinish = 'matte' | 'gloss'
type LightingMode = 'day' | 'garage'
export type LeftTab = 'draw' | 'ai' | 'upload' | 'export'

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
  /** 左侧面板当前激活标签 */
  activeLeftTab: LeftTab
  /** AI 设计提示词 */
  aiPrompt: string
  /** AI 生成中 */
  aiGenerating: boolean
  /** 3D 面板可见性 */
  panel3DVisible: boolean

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
  setActiveLeftTab: (tab: LeftTab) => void
  setAiPrompt: (prompt: string) => void
  setAiGenerating: (generating: boolean) => void
  setPanel3DVisible: (visible: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'select',
  shapeType: 'rect',
  color: '#ff2d55',
  brushSize: 12,
  fontSize: 68,
  fontFamily: 'Inter',
  textureDataUrl: null,
  materialFinish: 'gloss',
  lightingMode: 'day',
  autoRotate: true,
  activeLeftTab: 'draw',
  aiPrompt: '',
  aiGenerating: false,
  panel3DVisible: true,

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
  setActiveLeftTab: (activeLeftTab) => set({ activeLeftTab }),
  setAiPrompt: (aiPrompt) => set({ aiPrompt }),
  setAiGenerating: (aiGenerating) => set({ aiGenerating }),
  setPanel3DVisible: (panel3DVisible) => set({ panel3DVisible }),
}))
