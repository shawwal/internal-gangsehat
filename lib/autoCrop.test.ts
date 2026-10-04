import { describe, expect, it } from 'vitest'
import { detectContentBounds } from './autoCrop'

function canvas(width: number, height: number, bg: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255
  }
  const fill = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]
    }
  }
  return { px: { data, width, height }, fill }
}

describe('detectContentBounds', () => {
  it('finds a bright receipt on a dark desk', () => {
    const { px, fill } = canvas(200, 200, [40, 30, 20])
    fill(50, 20, 150, 180, [245, 245, 245])
    const crop = detectContentBounds(px)!
    expect(crop).not.toBeNull()
    expect(crop.x).toBeCloseTo(0.23, 1)
    expect(crop.y).toBeCloseTo(0.08, 1)
    expect(crop.x + crop.w).toBeCloseTo(0.77, 1)
    expect(crop.y + crop.h).toBeCloseTo(0.92, 1)
  })

  it('ignores sparse noise in the background', () => {
    const { px, fill } = canvas(200, 200, [255, 255, 255])
    fill(60, 60, 140, 140, [0, 0, 0])
    fill(5, 5, 6, 6, [0, 0, 0]) // single stray pixel
    const crop = detectContentBounds(px)!
    expect(crop.x).toBeGreaterThan(0.25)
  })

  it('returns null for a uniform image', () => {
    const { px } = canvas(100, 100, [128, 128, 128])
    expect(detectContentBounds(px)).toBeNull()
  })

  it('returns null when content already fills the frame', () => {
    const { px, fill } = canvas(100, 100, [255, 255, 255])
    fill(1, 1, 99, 99, [0, 0, 0])
    expect(detectContentBounds(px)).toBeNull()
  })
})
