import { BRAND_LOGOS } from '@/data/brandLogos'

/**
 * Logo real de una marca (Netflix, Spotify, etc.), en su color oficial.
 * Se dibuja sobre fondo blanco fijo (sin importar el tema de la app) porque
 * varias marcas usan negro puro (HBO, Patreon) — invisible sobre superficies
 * oscuras — y porque así es como estos logos se ven en sus propias guías.
 */
export function BrandLogo({ slug, size = 22 }: { slug: string; size?: number }) {
  const logo = BRAND_LOGOS[slug]
  if (!logo) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={logo.title}>
      <path d={logo.path} fill={logo.hex} />
    </svg>
  )
}
