/**
 * Helper meta SEO untuk route TanStack Router.
 * Semua URL absolut dibangun dari SITE_URL (env VITE_SITE_URL, fallback domain produksi).
 */

export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://bandjari.net'

export const SITE_NAME = 'BandJari'

export const DEFAULT_DESCRIPTION =
  'Penyusun & pemutar pola pukulan rebana Al-Banjari — susun pola 4 rebana + 1 bass per section, dan mainkan live cukup dengan jari.'

export const OG_IMAGE = `${SITE_URL}/og-image.png`

/** URL absolut untuk canonical/og:url dari pathname route (trailing slash dinormalkan). */
export function canonicalUrl(pathname: string): string {
  const path = pathname === '/' ? '' : pathname.replace(/\/+$/, '')
  return `${SITE_URL}${path}`
}

interface SeoMetaOptions {
  title: string;
  description: string;
  /** `match.pathname` dari route — dipakai untuk canonical & og:url. */
  pathname: string;
  /** Halaman private (butuh login) — sembunyikan dari mesin pencari. */
  noindex?: boolean;
}

/**
 * Bangun entri meta + links (canonical) untuk route head().
 * TanStack Router me-merge head dari root → leaf; leaf menang untuk key yang sama.
 */
export function seoMeta({ title, description, pathname, noindex = false }: SeoMetaOptions) {
  const url = canonicalUrl(pathname)
  const robots = noindex ? 'noindex, nofollow' : 'index, follow'
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:locale', content: 'id_ID' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: OG_IMAGE },
      { name: 'robots', content: robots },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}
