import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Customer, DesignOption, SpaceNode, TileFormat } from '../utils/api'

/** The two separate tile references the salesperson supplies. */
export type TileTarget = 'highlighter' | 'plain'

export type GeneratedResult = {
  generationId: string
  /**
   * The concepts produced so far, in the order they were asked for. One
   * request makes one image; asking for another appends to this.
   */
  images: string[]
  /**
   * The revision each concept came from, in the same order.
   *
   * Saving names a concept rather than uploading one, so the server files it
   * under the customer and application it was really generated for. A
   * concept with no revision id could not be recorded and cannot be saved.
   */
  revisionIds?: (string | null)[]
  /** The highlighter photo's URL (Google Drive, or a base64 fallback). */
  highlighterTileImageUrl?: string
  /** The plain photo's URL. Absent when there was no plain tile. */
  plainTileImageUrl?: string
  space?: string
  tileSize?: string
}

type FlowContextValue = {
  /**
   * Whose consultation this is. Chosen before the flow starts and kept across
   * it, so a second visualisation for the same client never asks again.
   */
  customer: Customer | null
  /** The highlighter photo as captured/uploaded, before cropping. Crop reads this. */
  highlighterSource: string | null
  /** The cropped highlighter tile — the image that is actually sent. */
  highlighterTileImage: string | null
  /** The plain photo as captured/uploaded, before cropping. */
  plainSource: string | null
  /** The cropped plain tile. Null when there is none, whichever way that came about. */
  plainTileImage: string | null
  /**
   * The explicit plain-tile decision:
   *   null  — not decided yet
   *   true  — a plain tile image was supplied (`plainTileImage` is set)
   *   false — the user explicitly chose "No Plain Tile"
   * Kept separate from `plainTileImage` so "no plain tile" is a choice the
   * backend is told about, never an empty image that merely looks like one.
   */
  plainTileProvided: boolean | null
  tileSize: string | null
  /**
   * The catalogue entry the size came from, where it did — set alongside
   * tileSize so a screen can show the showroom's own label for it without a
   * second fetch. Null for a size typed in by hand.
   */
  tileFormatOption: TileFormat | null
  space: string | null
  /**
   * The application chosen, root category first — Bathroom -> Powder Washroom
   * -> Half Height. The ids go to the server, which re-checks the chain before
   * it instructs the model.
   */
  spacePath: SpaceNode[]
  /**
   * Where the highlighter tile is to be used — chosen from the showroom's own
   * list. A hard placement input, not a description of the room.
   */
  highlighterLocationOption: DesignOption | null
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
  /** Stores a freshly captured/uploaded photo, ready for the crop screen. */
  setTileSource: (target: TileTarget, image: string) => void
  /** Stores a finished crop. For the plain tile this also records that one was provided. */
  setCroppedTile: (target: TileTarget, image: string) => void
  /** Forgets one tile's photo and crop (e.g. "throw this away and retake"). */
  clearTile: (target: TileTarget) => void
  /** The explicit "No Plain Tile" choice. Discards any plain photo already taken. */
  selectNoPlainTile: () => void
  /** Forgets both tile references, so a new consultation cannot inherit the last one. */
  resetTileInputs: () => void
  setTileSize: (tileSize: string | null) => void
  setTileFormatOption: (tileFormatOption: TileFormat | null) => void
  setSpace: (space: string | null) => void
  setSpacePath: (spacePath: SpaceNode[]) => void
  setHighlighterLocationOption: (option: DesignOption | null) => void
  setJointWidthMm: (jointWidthMm: number | null) => void
  setJointOption: (jointOption: DesignOption | null) => void
  setPatternOption: (patternOption: DesignOption | null) => void
  setAdditionalRequirement: (additionalRequirement: string) => void
  setGeneratedResult: (generatedResult: GeneratedResult | null) => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

export function FlowProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [highlighterSource, setHighlighterSource] = useState<string | null>(null)
  const [highlighterTileImage, setHighlighterTileImage] = useState<string | null>(null)
  const [plainSource, setPlainSource] = useState<string | null>(null)
  const [plainTileImage, setPlainTileImage] = useState<string | null>(null)
  const [plainTileProvided, setPlainTileProvided] = useState<boolean | null>(null)
  const [tileSize, setTileSize] = useState<string | null>(null)
  const [tileFormatOption, setTileFormatOption] = useState<TileFormat | null>(null)
  const [space, setSpace] = useState<string | null>(null)
  const [spacePath, setSpacePath] = useState<SpaceNode[]>([])
  const [highlighterLocationOption, setHighlighterLocationOption] = useState<DesignOption | null>(null)
  const [jointWidthMm, setJointWidthMm] = useState<number | null>(null)
  const [jointOption, setJointOption] = useState<DesignOption | null>(null)
  const [patternOption, setPatternOption] = useState<DesignOption | null>(null)
  const [additionalRequirement, setAdditionalRequirement] = useState('')
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null)

  const setTileSource = (target: TileTarget, image: string) => {
    if (target === 'highlighter') setHighlighterSource(image)
    else setPlainSource(image)
  }

  const setCroppedTile = (target: TileTarget, image: string) => {
    if (target === 'highlighter') {
      setHighlighterTileImage(image)
      return
    }
    setPlainTileImage(image)
    setPlainTileProvided(true)
  }

  const clearTile = (target: TileTarget) => {
    if (target === 'highlighter') {
      setHighlighterSource(null)
      setHighlighterTileImage(null)
      return
    }
    // Throwing the plain photo away is not the same as choosing "No Plain
    // Tile": the decision goes back to undecided, and the screen asks again.
    setPlainSource(null)
    setPlainTileImage(null)
    setPlainTileProvided(null)
  }

  const selectNoPlainTile = () => {
    setPlainSource(null)
    setPlainTileImage(null)
    setPlainTileProvided(false)
  }

  const resetTileInputs = () => {
    setHighlighterSource(null)
    setHighlighterTileImage(null)
    setPlainSource(null)
    setPlainTileImage(null)
    setPlainTileProvided(null)
  }

  return (
    <FlowContext.Provider
      value={{
        customer,
        highlighterSource,
        highlighterTileImage,
        plainSource,
        plainTileImage,
        plainTileProvided,
        tileSize,
        tileFormatOption,
        space,
        spacePath,
        highlighterLocationOption,
        jointWidthMm,
        jointOption,
        patternOption,
        additionalRequirement,
        generatedResult,
        setCustomer,
        setTileSource,
        setCroppedTile,
        clearTile,
        selectNoPlainTile,
        resetTileInputs,
        setTileSize,
        setTileFormatOption,
        setSpace,
        setSpacePath,
        setHighlighterLocationOption,
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
