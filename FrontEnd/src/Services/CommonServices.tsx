import type { Location } from 'react-router-dom'
import type { PageItem } from '@/auth/lib/models'

const getCurrentPage = (pages: PageItem[] | undefined, location: Location) : PageItem | undefined => {
  if (pages !== undefined && pages?.filter((item) => item.navUrl === location.pathname).length === 1) {
    return pages?.filter((item) => item.navUrl === location.pathname)[0]
  }
  else{
    return undefined
  }
};

const getSpecificPageItem = (pages: PageItem[] | undefined, specificRoute: string) => {
  if (pages !== undefined && pages?.filter((item) => item.routeElement === specificRoute).length === 1) {
    return pages?.filter((item) => item.routeElement === specificRoute)[0]
  }
  else{
    return undefined
  }
};

const CommonService = {
  getCurrentPage, getSpecificPageItem
};

export default CommonService;