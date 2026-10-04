// Auto-crop for payment proofs: finds the part of a photo/screenshot that
// differs from its background (a receipt on a desk, a screenshot with empty
// margins) and returns its bounding box. Pure — runs on raw RGBA pixels, so it
// works with canvas ImageData in the browser and plain arrays in tests.

import type { NormalizedCrop } from './imageCompress'

export interface Pixels {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

/** Per-channel difference (0–255, averaged) that counts as "not background". */
const FUZZ = 36
/** A row/column counts as content when this share of its pixels is foreground. */
const MIN_LINE_SHARE = 0.03
/** Breathing room kept around the detected content, as a share of each side. */
const PADDING = 0.02

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Returns the content bounds, or null when there's nothing meaningful to crop
 *  (background fills almost nothing, or content already fills the frame). */
export function detectContentBounds({ data, width, height }: Pixels): NormalizedCrop | null {
  if (width < 8 || height < 8) return null

  // Background colour = median of the outer ring of pixels.
  const rs: number[] = [], gs: number[] = [], bs: number[] = []
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2])
  }
  for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1) }
  for (let y = 1; y < height - 1; y++) { sample(0, y); sample(width - 1, y) }
  const bg = [median(rs), median(gs), median(bs)]

  const rowCounts = new Uint32Array(height)
  const colCounts = new Uint32Array(width)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const diff = (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2])) / 3
      if (diff > FUZZ) { rowCounts[y]++; colCounts[x]++ }
    }
  }

  const rowMin = Math.max(1, width * MIN_LINE_SHARE)
  const colMin = Math.max(1, height * MIN_LINE_SHARE)
  let top = 0, bottom = height - 1, left = 0, right = width - 1
  while (top < height && rowCounts[top] < rowMin) top++
  while (bottom > top && rowCounts[bottom] < rowMin) bottom--
  while (left < width && colCounts[left] < colMin) left++
  while (right > left && colCounts[right] < colMin) right--
  if (top >= bottom || left >= right) return null

  const padX = width * PADDING
  const padY = height * PADDING
  const x0 = Math.max(0, left - padX) / width
  const y0 = Math.max(0, top - padY) / height
  const x1 = Math.min(width, right + 1 + padX) / width
  const y1 = Math.min(height, bottom + 1 + padY) / height
  const crop = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }

  const area = crop.w * crop.h
  if (area > 0.95 || area < 0.03) return null
  return crop
}
