import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Customer, DesignOption, SpaceNode } from '../utils/api'

export type GeneratedResult = {
  generationId: string
  /**
   * The concepts produced so far, in the order they were asked for. One
   * request makes one image; asking for another appends to this.
   */
  images: string[]
  /** The uploaded tile photo's URL (Google Drive, or a base64 fallback). */
  tileImageUrl?: string
  space?: string
  style?: string
  tileSize?: string
}

type FlowContextValue = {
  /**
   * Whose consultation this is. Chosen before the flow starts and kept across
   * it, so a second visualisation for the same client never asks again.
   */
  customer: Customer | null
  tileImage: string | null
  croppedImage: string | null
  tileSize: string | null
  space: string | null
  /**
   * The application chosen, root category first — Bathroom -> Powder Washroom
   * -> Half Height. The ids go to the server, which re-checks the chain before
   * it instructs the model.
   */
  spacePath: SpaceNode[]
  style: string | null
  /** The chosen design style, joint width and laying pattern. */
  styleOption: DesignOption | null
  /** Millimetres — from a preset or typed in. */
  jointWidthMm: number | null
  jointOption: DesignOption | null
  patternOption: DesignOption | null
  /**
   * Anything the customer asked for that the fixed choices do not cover —
   * "warm lighting rakhna hai", "vanity floating honi chahiye". Optional, and
   * usually blank.
   */
  additionalRequirement: string
  generatedResult: GeneratedResult | null
  setCustomer: (customer: Customer | null) => void
  setTileImage: (tileImage: string | null) => void
  setCroppedImage: (croppedImage: string | null) => void
  setTileSize: (tileSize: string | null) => void
  setSpace: (space: string | null) => void
  setSpacePath: (spacePath: SpaceNode[]) => void
  setStyle: (style: string | null) => void
  setStyleOption: (styleOption: DesignOption | null) => void
  setJointWidthMm: (jointWidthMm: number | null) => void
  setJointOption: (jointOption: DesignOption | null) => void
  setPatternOption: (patternOption: DesignOption | null) => void
  setAdditionalRequirement: (additionalRequirement: string) => void
  setGeneratedResult: (generatedResult: GeneratedResult | null) => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

export function FlowProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [tileImage, setTileImage] = useState<string | null>(null)
  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [tileSize, setTileSize] = useState<string | null>(null)
  const [space, setSpace] = useState<string | null>(null)
  const [spacePath, setSpacePath] = useState<SpaceNode[]>([])
  const [style, setStyle] = useState<string | null>(null)
  const [styleOption, setStyleOption] = useState<DesignOption | null>(null)
  const [jointWidthMm, setJointWidthMm] = useState<number | null>(null)
  const [jointOption, setJointOption] = useState<DesignOption | null>(null)
  const [patternOption, setPatternOption] = useState<DesignOption | null>(null)
  const [additionalRequirement, setAdditionalRequirement] = useState('')
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null)

  return (
    <FlowContext.Provider
      value={{
        customer,
        tileImage,
        croppedImage,
        tileSize,
        space,
        spacePath,
        style,
        styleOption,
        jointWidthMm,
        jointOption,
        patternOption,
        additionalRequirement,
        generatedResult,
        setCustomer,
        setTileImage,
        setCroppedImage,
        setTileSize,
        setSpace,
        setSpacePath,
        setStyle,
        setStyleOption,
        setJointWidthMm,
        setJointOption,
        setPatternOption,
        setAdditionalRequirement,
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
