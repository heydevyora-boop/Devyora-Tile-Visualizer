import { useCallback, useEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import './SpeechTextarea.css'

/**
 * The browser's own speech recognition (the Web Speech API), described just far
 * enough to use. It is not in TypeScript's built-in DOM types yet, and it is
 * exposed as `webkitSpeechRecognition` in Chrome, Edge and Safari.
 */
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

/**
 * The language the voice is read in. The instructions this app collects are
 * written in Latin script, often Hindi-English mixed ("warm lighting rakhna
 * hai"), which Indian English recognises well and which comes back as text in
 * the same script the keyboard produces.
 */
const SPEECH_LANGUAGE = 'en-IN'

/** What to tell the person, for each way recognition can fail. Never a raw error code. */
function messageFor(error: string): string | null {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.'
    case 'audio-capture':
      return 'No microphone was found on this device.'
    case 'network':
      return 'Voice input needs an internet connection. You can still type.'
    case 'no-speech':
      return "Didn't hear anything — tap the microphone and try again."
    case 'aborted':
      return null
    default:
      return "Voice input isn't available right now. You can still type."
  }
}

/** Spoken text added after what is already there, with one space between and nothing doubled. */
function appendSpoken(existing: string, spoken: string): string {
  const addition = spoken.replace(/\s+/g, ' ').trim()
  if (!addition) return existing
  if (!existing) return addition
  return /\s$/.test(existing) ? existing + addition : `${existing} ${addition}`
}

type SpeechTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

/**
 * A text area that can also be dictated into.
 *
 * Typing works exactly as it did. A microphone button sits inside the field: tap
 * it to speak, tap it again to stop. What is said is added to the end of what is
 * already written — never replacing it — and appears as it is recognised.
 * Typing while it is listening ends the dictation, so the two never fight over
 * the text.
 *
 * Only text is handled. This code never records, keeps or sends audio; the
 * recognition is the browser's own, and where the browser has none the button is
 * simply not shown.
 */
function SpeechTextarea({ value, onValueChange, maxLength, ...textareaProps }: SpeechTextareaProps) {
  const supported = recognitionConstructor() !== null
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const recognitionRef = useRef<Recognition | null>(null)
  // What was in the field when dictation began, and what has been recognised
  // and settled since. The field is always `base + settled + still-being-heard`.
  const baseRef = useRef('')
  const settledRef = useRef('')
  // Latest props, read from recognition callbacks that outlive a render.
  const valueRef = useRef(value)
  const onValueChangeRef = useRef(onValueChange)
  useEffect(() => {
    valueRef.current = value
    onValueChangeRef.current = onValueChange
  })

  const show = useCallback(
    (spoken: string) => {
      const next = appendSpoken(baseRef.current, spoken)
      onValueChangeRef.current(maxLength !== undefined ? next.slice(0, maxLength) : next)
    },
    [maxLength],
  )

  const stop = useCallback(() => recognitionRef.current?.stop(), [])

  // Drop the current session without waiting for it: it is forgotten first, so
  // anything it still reports is ignored (see the guards below), and the button
  // goes back to idle at once.
  const abandon = useCallback(() => {
    const current = recognitionRef.current
    recognitionRef.current = null
    current?.abort()
    setListening(false)
  }, [])

  const start = () => {
    const Constructor = recognitionConstructor()
    if (!Constructor) return
    setMessage(null)
    const recognition = new Constructor()
    recognition.lang = SPEECH_LANGUAGE
    recognition.continuous = true
    recognition.interimResults = true
    baseRef.current = valueRef.current
    settledRef.current = ''

    recognition.onstart = () => setListening(true)
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) settledRef.current += result[0].transcript
        else interim += result[0].transcript
      }
      show(settledRef.current + interim)
    }
    recognition.onerror = (event) => {
      if (recognitionRef.current === recognition) setMessage(messageFor(event.error))
    }
    recognition.onend = () => {
      // A session already abandoned must not switch off a newer one.
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
        setListening(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      // Already starting — a second tap landed before the first took effect.
      recognitionRef.current = null
    }
  }

  const toggle = () => {
    if (recognitionRef.current) stop()
    else start()
  }

  // Leaving the screen with the microphone open would leave it open.
  useEffect(
    () => () => {
      const current = recognitionRef.current
      recognitionRef.current = null
      current?.abort()
    },
    [],
  )

  return (
    <div className="speech-field">
      <textarea
        {...textareaProps}
        maxLength={maxLength}
        value={value}
        onChange={(event) => {
          // A keystroke ends dictation, and the session is abandoned so a late
          // result cannot overwrite what was just typed.
          abandon()
          onValueChange(event.target.value)
        }}
      />
      {supported && (
        <button
          type="button"
          className={`speech-field__mic${listening ? ' is-listening' : ''}`}
          aria-pressed={listening}
          aria-label={listening ? 'Stop voice input' : 'Speak your instructions'}
          onClick={toggle}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {listening ? 'graphic_eq' : 'mic'}
          </span>
        </button>
      )}
      {(listening || message) && (
        <p className={`speech-field__status${message && !listening ? ' is-error' : ''}`} role="status">
          {listening ? 'Listening… tap the microphone to stop.' : message}
        </p>
      )}
    </div>
  )
}

export default SpeechTextarea
