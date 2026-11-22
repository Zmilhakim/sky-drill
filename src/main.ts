const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  draw()
}

function draw() {
  const w = canvas.width
  const h = canvas.height

  // Dark background
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, w, h)

  // Centered text
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const fontSize = Math.min(w, h) * 0.08
  ctx.font = `${fontSize}px monospace`
  ctx.fillText('Booth game', w / 2, h / 2)
}

window.addEventListener('resize', resize)
resize()
