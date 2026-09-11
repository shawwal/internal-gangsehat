'use client'

// Client-side image compression: downsizes + re-encodes as WebP before upload,
// so avatars never hit storage as multi-MB JPEG/PNG originals.

const DEFAULT_MAX_DIMENSION = 512
const DEFAULT_QUALITY = 0.85

export interface CompressImageOptions {
  maxDimension?: number
  quality?: number
}

/** Downscales `file` to fit within `maxDimension` and re-encodes it as WebP.
 *  Falls back to the original file if the browser can't produce a WebP blob
 *  (very old browsers) or the input isn't a raster image canvas can decode. */
export async function compressImageToWebp(
  file: File,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: CompressImageOptions = {},
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    )
    if (!blob) return file

    const newName = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], newName, { type: 'image/webp' })
  } catch {
    return file
  }
}
