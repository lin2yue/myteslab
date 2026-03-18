'use client'

import { create } from 'zustand'

type ToolType = 'paint' | 'shape' | 'text'
type ShapeType = 'rect' | 'circle'

type EditorState = {
  tool: ToolType
  shapeType: ShapeType
  color: string
  brushSize: number
  textureDataUrl: string | null
  setTool: (tool: ToolType) => void
  setShapeType: (shape: ShapeType) => void
  setColor: (color: string) => void
  setBrushSize: (size: number) => void
  setTextureDataUrl: (dataUrl: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'paint',
  shapeType: 'rect',
  color: '#ff2d55',
  brushSize: 12,
  textureDataUrl: null,
  setTool: (tool) => set({ tool }),
  setShapeType: (shapeType) => set({ shapeType }),
  setColor: (color) => set({ color }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setTextureDataUrl: (textureDataUrl) => set({ textureDataUrl })
}))
