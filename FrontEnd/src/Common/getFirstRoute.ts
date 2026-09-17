import type { PageItem } from '@/auth/lib/models'

export const getFirstRoute = (pages: PageItem[]): string | null => {
  for (const page of pages) {
    // skip menu-only or invisible pages
    if (page.visible && !page.onlyRoute && page.navUrl) {
      return page.navUrl
    }

    if (page.pages?.length) {
      const child = getFirstRoute(page.pages)
      if (child) return child
    }
  }
  return null
}