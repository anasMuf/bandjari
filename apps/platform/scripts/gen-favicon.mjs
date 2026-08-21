import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const svgPath = resolve('public/icon_bandjari.svg')
const svgDataUri =
  'data:image/svg+xml;base64,' + readFileSync(svgPath).toString('base64')

const browser = await chromium.launch()
const page = await browser.newPage()

// Render SVG ke img dengan berbagai ukuran, screenshot elemen -> PNG buffer
async function renderPng(size, { background } = {}) {
  await page.setContent(`
    <body style="margin:0;padding:0;background:${background ?? 'transparent'}">
      <img id="f" width="${size}" height="${size}" src="${svgDataUri}" />
    </body>
  `)
  await page.waitForTimeout(300)
  const buf = await page.locator('#f').screenshot({ omitBackground: background === undefined })
  return buf
}

// Verifikasi: ada pixel non-transparan & warna hijau brand (bukti SVG ter-render)
const verify = await page.setContent(`
  <body style="margin:0"><canvas id="c" width="48" height="48"></canvas></body>
`)
const canvasResult = await page.evaluate(async (uri) => {
  const img = new Image()
  img.src = uri
  await img.decode()
  const c = document.getElementById('c')
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, 48, 48)
  const data = ctx.getImageData(0, 0, 48, 48).data
  let opaque = 0
  let green = 0
  let white = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a > 0) {
      opaque++
      if (g > 100 && r < 100 && b > 80) green++ // #099268 = r9 g146 b104
      if (r > 240 && g > 240 && b > 240) white++
    }
  }
  return { opaquePixels: opaque, greenPixels: green, whitePixels: white, total: 48 * 48 }
}, svgDataUri)
console.log('verifikasi render:', JSON.stringify(canvasResult))

// Tulis favicon.ico (entry PNG: 16, 32, 48)
const sizes = [16, 32, 48]
const entries = []
for (const size of sizes) {
  const png = await renderPng(size)
  entries.push({ size, png })
  console.log(`PNG ${size}x${size}: ${png.length} bytes`)
}

function writeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)
  const dirSize = 16 * entries.length
  let offset = 6 + dirSize
  const dirs = []
  for (const e of entries) {
    const d = Buffer.alloc(16)
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 0)
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 1)
    d.writeUInt8(0, 2)
    d.writeUInt8(0, 3)
    d.writeUInt16LE(1, 4) // planes
    d.writeUInt16LE(32, 6) // bit count
    d.writeUInt32LE(e.png.length, 8)
    d.writeUInt32LE(offset, 12)
    dirs.push(d)
    offset += e.png.length
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)])
}

const ico = writeIco(entries)
writeFileSync(resolve('public/favicon.ico'), ico)
console.log('favicon.ico ditulis:', ico.length, 'bytes')

// Apple Touch Icon — iOS tidak mendukung transparansi (area transparan diisi
// hitam), jadi render di atas background brand teal solid, ukuran standar 180x180.
const appleIcon = await renderPng(180, { background: '#0f766e' })
writeFileSync(resolve('public/apple-touch-icon.png'), appleIcon)
console.log('apple-touch-icon.png ditulis:', appleIcon.length, 'bytes')
await browser.close()
