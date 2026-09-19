import { createContext, useContext, useState, type ReactNode } from 'react'

export type GeneratedResult = {
  generationId: string
  images: string[]
  space?: string
  style?: string
  tileSize?: string
}

type FlowContextValue = {
  tileImage: string | null
  croppedImage: string | null
  tileSize: string | null
  space: string | null
  style: string | null
  generatedResult: GeneratedResult | null
  setTileImage: (tileImage: string | null) => void
  setCroppedImage: (croppedImage: string | null) => void
  setTileSize: (tileSize: string | null) => void
  setSpace: (space: string | null) => void
  setStyle: (style: string | null) => void
  setGeneratedResult: (generatedResult: GeneratedResult | null) => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

export function FlowProvider({ children }: { children: ReactNode }) {
  const [tileImage, setTileImage] = useState<string | null>(null)
  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [tileSize, setTileSize] = useState<string | null>(null)
  const [space, setSpace] = useState<string | null>(null)
  const [style, setStyle] = useState<string | null>(null)
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null)

  return (
    <FlowContext.Provider
      value={{
        tileImage,
        croppedImage,
        tileSize,
        space,
        style,
        generatedResult,
        setTileImage,
        setCroppedImage,
        setTileSize,
        setSpace,
        setStyle,
        setGeneratedResult,
      }}
    >
      {children}
    </FlowContext.Provider>
  )
}

export function useFlow() {
  const context = useContext(FlowContext)
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider')
  }
  return context
}
