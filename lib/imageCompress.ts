'use client'

// Client-side image compression: downsizes + re-encodes as WebP before upload,
// so images never hit storage as multi-MB JPEG/PNG originals.
//
// Safari (macOS, iPhone, iPad) can't encode WebP from a canvas — `toBlob(…,
// 'image/webp')` silently returns a PNG. When that happens we fall back to a
// libwebp WASM encoder (@jsquash/webp, loaded on demand) so every browser
// produces a real, small WebP.

const DEFAULT_MAX_DIMENSION = 512
const DEFAULT_QUALITY = 0.85

export interface CompressImageOptions {
  maxDimension?: number
  quality?: number
}

/** Crop rectangle as fractions (0–1) of the source width/height. */
export interface NormalizedCrop {
  x: number
  y: number
  w: number
  h: number
}

/** Decodes any image the browser can display (incl. multi-MB camera photos,
 *  and HEIC on Safari). EXIF orientation is applied by the browser. */
export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    // decode() has finished, so the pixels are held by the element.
    URL.revokeObjectURL(url)
  }
}

/** Encodes `canvas` as WebP: native encoder first, WASM fallback for Safari. */
export async function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const native: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (native && native.type === 'image/webp') return native

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  const { default: encode } = await import('@jsquash/webp/encode')
  const buffer = await encode(ctx.getImageData(0, 0, canvas.width, canvas.height), { quality: Math.round(quality * 100) })
  return new Blob([buffer], { type: 'image/webp' })
}

export interface RenderWebpOptions {
  maxDimension: number
  quality: number
  /** Re-encode at lower quality / size until the result fits. */
  maxBytes?: number
  crop?: NormalizedCrop | null
}

/** Crops `source`, scales it to fit `maxDimension`, and encodes it as WebP. */
export async function renderWebp(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  { maxDimension, quality, maxBytes, crop }: RenderWebpOptions,
): Promise<Blob> {
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const sx = Math.round(c.x * sourceWidth)
  const sy = Math.round(c.y * sourceHeight)
  const sw = Math.max(1, Math.round(c.w * sourceWidth))
  const sh = Math.max(1, Math.round(c.h * sourceHeight))

  let dim = maxDimension
  let q = quality
  for (;;) {
    const scale = Math.min(1, dim / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * scale))
    canvas.height = Math.max(1, Math.round(sh * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const blob = await canvasToWebp(canvas, q)
    if (!maxBytes || blob.size <= maxBytes || dim <= 600) return blob
    // Too big: drop quality first, then resolution.
    if (q > 0.5) q = Math.max(0.5, q - 0.15)
    else dim = Math.round(dim * 0.8)
  }
}

/** Downscales `file` to fit within `maxDimension` and re-encodes it as WebP.
 *  Falls back to the original file if the input isn't an image the browser
 *  can decode. */
export async function compressImageToWebp(
  file: File,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: CompressImageOptions = {},
): Promise<File> {
  try {
    const img = await loadImage(file)
    const blob = await renderWebp(img, img.naturalWidth, img.naturalHeight, { maxDimension, quality })
    const newName = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], newName, { type: 'image/webp' })
  } catch {
    return file
  }
}
