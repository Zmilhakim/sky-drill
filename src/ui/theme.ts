export const COLOR = {
  bgTop: '#06121f',
  bgBottom: '#0c2740',
  sky: '#35b6ff',
  skyDim: '#1b5f8c',
  white: '#f4f9ff',
  dim: '#8fa9c2',
  rival: '#ff5d4f',
  gold: '#ffd24a',
  panel: 'rgba(10, 28, 46, 0.88)',
  line: 'rgba(120, 180, 230, 0.25)',
}

export const FONT = '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif'

export function font(size: number, weight = 700): string {
  return `${weight} ${size}px ${FONT}`
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'center',
  weight = 700,
): void {
  ctx.font = font(size, weight)
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}
