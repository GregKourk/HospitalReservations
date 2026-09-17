import { useEffect, useState } from 'react';
import { StoreClientTopbar } from '@/pages/store-client/components/common/topbar';
import { NotificationsSheet } from '@/partials/topbar/notifications-sheet';
import { UserDropdownMenu } from '@/partials/topbar/user-dropdown-menu';
import { Bell, Menu } from 'lucide-react';
import { UserAvatarTrigger } from '@/partials/topbar/user-dropdown-menu';
import { useLocation } from 'react-router';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollPosition } from '@/hooks/use-scroll-position';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Container } from '@/components/common/container';
import { Breadcrumb } from './breadcrumb';
import { DynamicSideBarMenu } from './dynamic-sidebar-menu';

import { useAuth } from '@/auth/context/auth-context';
import CommonService from '@/Services/CommonServices';
import { getUnreadNotificationCount } from '@/services/hospital-api';


export function Header() {
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);

  const { pathname } = useLocation();
  const mobileMode = useIsMobile();

  const scrollPosition = useScrollPosition();
  const headerSticky: boolean = scrollPosition > 0;

  const { routesAllowed, currentUser } = useAuth();
  const [pageTitle, setPageTitle] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);

  // Close sheet when route changes
  useEffect(() => {
    setIsSidebarSheetOpen(false);
    // Get the Page name from the current route and set it in the header
    const currentPage = CommonService.getCurrentPage(routesAllowed, { pathname } as any);
    setPageTitle(currentPage ? currentPage.name : '');

  }, [pathname]);

  // Bell badge: refreshed on mount, on a live "Notification" push from
  // SignalR, and on a 60s fallback poll in case the socket ever drops.
  useEffect(() => {
    if (!currentUser) return;
    const refresh = () => { getUnreadNotificationCount().then(({ data }) => setUnreadCount(data)).catch(() => {}); };
    refresh();
    const handler = (e: Event) => { if ((e as CustomEvent).detail?.event === 'Notification') refresh(); };
    window.addEventListener('signalr-update', handler);
    window.addEventListener('notifications-changed', refresh);
    const interval = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('signalr-update', handler);
      window.removeEventListener('notifications-changed', refresh);
      clearInterval(interval);
    };
  }, [currentUser]);

  return (
    <header
      className={cn(
        'header fixed top-0 z-10 start-0 flex items-stretch shrink-0 border-b border-transparent bg-background end-0 pe-[var(--removed-body-scroll-bar-size,0px)]',
        headerSticky && 'border-b border-border',
      )}
    >
      <Container width="fluid" className="flex justify-between items-stretch lg:gap-4">
        {/* HeaderLogo */}
        <div className="flex gap-1 lg:hidden items-center gap-2.5">
          <Link to="/" className="shrink-0">
            <img
              src={toAbsoluteUrl('/media/brand-logos/cloud-one.svg')}
              className="h-[25px] w-full"
              alt="mini-logo"
            />
          </Link>
          <div className="flex items-center">
            {mobileMode && (
              <Sheet
                open={isSidebarSheetOpen}
                onOpenChange={setIsSidebarSheetOpen}
              >
                <SheetTrigger asChild>
                  <Button variant="ghost" mode="icon">
                    <Menu className="text-muted-foreground/70" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  className="p-0 gap-0 w-[275px]"
                  side="left"
                  close={false}
                >
                  <SheetHeader className="p-0 space-y-0" />
                  <SheetBody className="p-0 overflow-y-auto">
                    <DynamicSideBarMenu />
                    {/* <SidebarMenu /> */}
                  </SheetBody>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        {pathname.startsWith('/account') && <Breadcrumb />}

        {/* PageTitle */}
        <div className="flex gap-1 items-center gap-2.5">
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
        </div>

        {/* HeaderTopbar */}
        <div className="flex items-center gap-3 ml-auto">
          {pathname.startsWith('/store-client') ? (
            <StoreClientTopbar />
          ) : (
            <>
              <NotificationsSheet
                trigger={
                  <Button
                    variant="ghost"
                    mode="icon"
                    shape="circle"
                    className="relative size-9 hover:bg-primary/10 hover:[&_svg]:text-primary"
                  >
                    <Bell className="size-4.5!" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 end-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] leading-none text-destructive-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                }
              />
              <UserDropdownMenu trigger={<UserAvatarTrigger />} />
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
