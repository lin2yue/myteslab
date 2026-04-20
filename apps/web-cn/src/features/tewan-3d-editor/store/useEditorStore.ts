'use client'

import { create } from 'zustand'

type ToolType = 'select' | 'pan' | 'paint' | 'erase' | 'shape' | 'text' | 'sticker'
type ShapeType = 'rect' | 'circle' | 'line'
type LightingMode = 'day' | 'garage'
export type LeftTab = 'draw' | 'ai' | 'upload' | 'export'
/** Canva 风格左侧导航。null = 面板收起 */
export type LeftPanel = 'base' | 'ai' | 'elements' | 'upload' | 'text' | 'draw' | 'layers' | null

type EditorState = {
  tool: ToolType
  shapeType: ShapeType
  color: string
  brushSize: number
  fontSize: number
  fontFamily: string
  textureDataUrl: string | null
  lightingMode: LightingMode
  /** 默认关闭自动旋转，避免编辑时画面跳动 */
  autoRotate: boolean
  /** 左侧面板当前激活标签（legacy，保留兼容） */
  activeLeftTab: LeftTab
  /** Canva 风格：当前展开的左侧面板，null 表示全部收起 */
  leftPanel: LeftPanel
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
  setLightingMode: (mode: LightingMode) => void
  setAutoRotate: (on: boolean) => void
  setActiveLeftTab: (tab: LeftTab) => void
  setLeftPanel: (panel: LeftPanel) => void
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
  lightingMode: 'day',
  autoRotate: false,
  activeLeftTab: 'draw',
  leftPanel: 'base',
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
  setLightingMode: (lightingMode) => set({ lightingMode }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setActiveLeftTab: (activeLeftTab) => set({ activeLeftTab }),
  setLeftPanel: (leftPanel) => set({ leftPanel }),
  setAiPrompt: (aiPrompt) => set({ aiPrompt }),
  setAiGenerating: (aiGenerating) => set({ aiGenerating }),
  setPanel3DVisible: (panel3DVisible) => set({ panel3DVisible }),
}))
