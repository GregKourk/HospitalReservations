import { createContext, useContext, useState } from "react"
import { MenuConfig } from "@/config/types"

const MenuContext = createContext<{
  menu: MenuConfig
  setMenu: (m:MenuConfig)=>void
}>({
  menu: [],
  setMenu: ()=>{}
})

export const DynamicMenuProvider = ({children}:{children:React.ReactNode}) => {

  const [menu,setMenu] = useState<MenuConfig>([])

  return (
    <MenuContext.Provider value={{menu,setMenu}}>
      {children}
    </MenuContext.Provider>
  )
}

export const useMenuConfig = ()=> useContext(MenuContext)