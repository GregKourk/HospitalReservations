import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { SidebarHeader } from './sidebar-header';
// import { SidebarMenu } from './sidebar-menu';
import { SidebarFooter } from './sidebar-footer'; // Kyparlis: To add sidebar footer at Demo1 for our app
import { DynamicSideBarMenu } from './dynamic-sidebar-menu';
// import { useMenuConfig } from '@/providers/DynamicMenuProvider';

export function Sidebar() {
  const { settings } = useSettings();
  const { pathname } = useLocation();
  // const { menu } = useMenuConfig()

  return (
    <div
      className={cn(
        'sidebar bg-background lg:border-e lg:border-border lg:fixed lg:top-0 lg:bottom-0 lg:z-20 lg:flex flex-col items-stretch shrink-0',
        (settings.layouts.demo1.sidebarTheme === 'dark' ||
          pathname.includes('dark-sidebar')) &&
        'dark',
      )}
      style={{
        background: cn('linear-gradient(to right, var(--bg-top), var(--bg-base) 80%)'),
        boxShadow: cn('var(--shadow-color) 4px 0px 10px 0px'),         
      }}
    >
      <SidebarHeader />
      {/* <SidebarMenu /> */}
      <div className="overflow-hidden flex grow shrink-0 lg:max-h-[calc(100vh-5.5rem)]">        
        <div className="w-(--sidebar-default-width)">
          <DynamicSideBarMenu />         
        </div>
      </div>
      <SidebarFooter />
    </div>
  );
}
