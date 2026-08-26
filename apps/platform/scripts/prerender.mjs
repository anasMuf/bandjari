/**
 * Pre-render SEO head (title, description, OG, Twitter, canonical, JSON-LD)
 * untuk halaman publik ke HTML statis di dist/.
 *
 * Masalah: platform adalah SPA (Vite + TanStack Router). Meta per-route
 * didefinisikan di head() tiap route dan dirender klien-side oleh HeadContent —
 * crawler yang tidak mengeksekusi JS (Googlebot tanpa rendering budget,
 * scraper preview FB/WA/Telegram, dll.) hanya melihat index.html kosong meta.
 *
 * Solusi: jalankan setelah `vite build`. Untuk tiap route publik, router
 * di-load di Node (memory history) dan tag head dibangun dari head() route
 * (sumber kebenaran yang sama), lalu disuntikkan ke index.html hasil build →
 * dist/<path>/index.html. Body SPA tidak disentuh → tanpa risiko hydration.
 * nginx `try_files $uri $uri/` sudah melayani file ini untuk /explore dst.
 */

import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(root, 'dist')

const SITE_URL = process.env.VITE_SITE_URL || 'https://bandjari.net'

/**
 * Route publik & indexable (tanpa auth). Halaman private (/login, /project/*,
 * /songs/*) tidak di-prerender — mereka noindex dan memakai meta klien-side.
 * /templates/:songId dinamis (butuh data API) — belum di-prerender; meta
 * generik tetap terpasang klien-side.
 */
const PUBLIC_ROUTES = [
  '/',
  '/explore',
  '/bantuan',
  '/donasi',
  '/faq',
  '/kontak',
  '/privasi',
  '/syarat',
  '/tentang',
]

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

/**
 * Replikasi merge head TanStack Router (HeadContent → buildTagsFromMatches):
 * leaf-most route menang untuk key yang sama; title dari leaf; dedupe meta
 * berdasarkan name/property.
 */
function buildHeadTags(matches) {
  const metaByAttribute = new Map()
  const metaTags = []
  let title = null

  for (let i = matches.length - 1; i >= 0; i--) {
    const metas = matches[i].meta ?? []
    for (let j = metas.length - 1; j >= 0; j--) {
      const m = metas[j]
      if (!m) continue
      if (m.title) {
        if (!title) title = m.title
      } else if ('script:ld+json' in m) {
        try {
          const json = JSON.stringify(m['script:ld+json'])
          metaTags.push({
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: escapeHtml(json),
          })
        } catch {
          // JSON tidak valid — lewati
        }
      } else {
        const attribute = m.name ?? m.property
        if (attribute) {
          if (metaByAttribute.has(attribute)) continue
          metaByAttribute.set(attribute, true)
        }
        metaTags.push({ tag: 'meta', attrs: { ...m } })
      }
    }
  }
  if (title) metaTags.push({ tag: 'title', children: title })
  metaTags.reverse()

  const links = matches
    .flatMap((match) => match.links ?? [])
    .filter(Boolean)
    .map((link) => ({ tag: 'link', attrs: { ...link } }))

  return { metaTags, links }
}

function serializeTags({ metaTags, links }) {
  const parts = []
  for (const t of metaTags) {
    if (t.tag === 'title') {
      parts.push(`    <title>${escapeHtml(t.children)}</title>`)
    } else if (t.tag === 'script') {
      parts.push(`    <script type="${t.attrs.type}">${t.children}</script>`)
    } else {
      const attrs = Object.entries(t.attrs)
        .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
        .join(' ')
      parts.push(`    <meta ${attrs} />`)
    }
  }
  for (const l of links) {
    const attrs = Object.entries(l.attrs)
      .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
      .join(' ')
    parts.push(`    <link ${attrs} />`)
  }
  return parts.join('\n')
}

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

let ok = true
try {
  const { routeTree } = await vite.ssrLoadModule('/src/routeTree.gen.ts')
  const { createRouter, createMemoryHistory } = await vite.ssrLoadModule(
    '@tanstack/react-router',
  )

  const baseHtml = await readFile(resolve(distDir, 'index.html'), 'utf8')

  for (const pathname of PUBLIC_ROUTES) {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [pathname] }),
      context: { auth: null },
    })
    await router.load()
    const matches = router.stores.matches.get()
    const headTags = serializeTags(buildHeadTags(matches))
    const html = baseHtml.replace('  </head>', `${headTags}\n  </head>`)

    const outPath =
      pathname === '/'
        ? resolve(distDir, 'index.html')
        : resolve(distDir, pathname.slice(1), 'index.html')
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, html)
    console.log(`[prerender] ${pathname} → ${outPath}`)
  }

  // sitemap.xml — daftar URL publik statis.
  const urls = PUBLIC_ROUTES.map((pathname) => {
    const loc = pathname === '/' ? `${SITE_URL}/` : `${SITE_URL}${pathname}`
    const priority = pathname === '/' ? '1.0' : pathname === '/explore' ? '0.9' : '0.7'
    return `  <url>\n    <loc>${loc}</loc>\n    <priority>${priority}</priority>\n  </url>`
  }).join('\n')
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  await writeFile(resolve(distDir, 'sitemap.xml'), sitemap)
  console.log('[prerender] sitemap.xml → dist/sitemap.xml')
} catch (err) {
  console.error('[prerender] gagal:', err)
  ok = false
} finally {
  // Vite dev server (middleware mode) bisa meninggalkan watcher/websocket
  // yang menggantung proses — paksa exit sesuai status.
  await vite.close().catch(() => {})
  process.exit(ok ? 0 : 1)
}
