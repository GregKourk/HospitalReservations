import type { MenuItem } from '@/config/types'
import type { PageItem } from '@/auth/lib/models'
import type { LucideIcon } from 'lucide-react'
import { resolveIcon } from './iconMap'

export const mapPageItemsToMenu = (
  pages: PageItem[],
  parentRootPath?: string,
  hasEditRole?: boolean,
): MenuItem[] => {
  return pages
    // 1️⃣ Only show visible items
    .filter((p) => p.visible)
    // 2️⃣ Sort by backend order
    .sort((a, b) => a.orderValue - b.orderValue)
    // 3️⃣ Map
    .map<MenuItem>((page, index) => {
      const hasChildren = page.pages && page.pages.length > 0

      return {
        title: page.navTitle || page.name,
        path: page.onlyRoute ? undefined : page.navUrl,
        rootPath: parentRootPath ?? page.navUrl,
        icon: resolveIcon(page.navIcon),
        // Being in pagesAllowed at all already means the role has access —
        // there's no separate view/edit tier in this app's RBAC model, so
        // no per-item disabled state or Edit/View badge to show here.
        separator: false,

        // Accordion behavior
        collapse: false,
        
        childrenIndex: index,

        // Recursive children
        children: hasChildren
          ? mapPageItemsToMenu(page.pages, page.navUrl, hasEditRole)
          : undefined,
      }
    })
}