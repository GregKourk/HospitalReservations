import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'
import type { PageItem } from '@/auth/lib/models'

export const mapPageItemsToRoutes = (
  pages: PageItem[],
): RouteObject[] => {
  return pages.flatMap((page) => {
    const routes: RouteObject[] = []

    if (page.routeElement) {
      const Component = lazy(() =>
        /* @vite-ignore */
        import(`@/pages/${page.routeElement}.tsx`)
      )

      routes.push({
        path: page.routeCombPath || page.navUrl,
        element: <Component />,
      })
    }

    if (page.pages?.length) {
      routes.push(...mapPageItemsToRoutes(page.pages))
    }

    return routes
  })
}