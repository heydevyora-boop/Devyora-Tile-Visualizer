// Deployed copy of the model config used by the Vercel serverless function in
// client/api/. Vercel only uploads files under the project Root Directory
// (client/), so this cannot import from ../../server/src.
// KEEP IN SYNC with the local-dev Express copy in server/src/config/.
/**
 * Single source of truth for the Gemini image model and its output shape.
 * Overridable via GEMINI_IMAGE_MODEL without a code change.
 *
 * gemini-3.1-flash-lite-image ("Nano Banana 2 Lite") generates the same
 * 1024x1024 concepts as the non-lite model at a lower per-image cost.
 */
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image'

/** One of the aspect ratios this model supports. */
export const IMAGE_ASPECT_RATIO = '1:1'

/** '1K' == 1024x1024. This model does not support '2K'/'4K'. */
export const IMAGE_SIZE = '1K'
