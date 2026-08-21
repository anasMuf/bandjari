import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' }).catch(() => {})
await page.waitForTimeout(2000)
const faviconUrl = await page.favicon().catch(() => null)
console.log('favicon URL dipilih browser:', faviconUrl)
// Cek juga apakah favicon.ico bisa di-fetch dan berapa ukurannya
const resp = await page.request.get('http://localhost:4173/favicon.ico').catch(() => null)
console.log('favicon.ico status:', resp?.status(), 'size:', resp ? (await resp.body()).length : 0)
await browser.close()
