import { MenuItem, MenuConfig } from '@/config/types';
import { PageItem } from '@/auth/lib/models';

export function mapPagesToMenu(pages: PageItem[]): MenuConfig {
  const mapPage = (page: PageItem): MenuItem => {

    const item: MenuItem = {
      title: page.navTitle,
      path: page.routeCombPath,
      icon: undefined,
    }

    if (page.pages?.length) {
      item.children = page.pages.map(mapPage)
    }

    return item
  }

  return pages
    .filter(p => p.visible)
    .sort((a,b)=>a.orderValue-b.orderValue)
    .map(mapPage)
}