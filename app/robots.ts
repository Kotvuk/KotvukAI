import { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kotvuk.asia'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register'],
        disallow: ['/dashboard/', '/api/', '/admin/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
