// import { ChatSheet } from '@/partials/topbar/chat-sheet';
// import { NotificationsSheet } from '@/partials/topbar/notifications-sheet';
// import { UserDropdownMenu } from '@/partials/topbar/user-dropdown-menu';
// import { MessageCircleMore, MessageSquareDot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
// import { Button } from '@/components/ui/button';

export function SidebarFooter() {
  const currentYear = new Date().getFullYear();
  const strVersion = 'v1.1';

  return (
    <div className="sidebar-header hidden lg:flex items-center relative justify-between px-3 lg:px-6 shrink-0">
      <div className="default-logo order-2 md:order-1 gap-2 font-normal text-sm">
        <span className="text-muted-foreground">
          {currentYear} &copy;
          <a
            href="https://keenthemes.com"
            target="_blank"
            className="text-secondary-foreground hover:text-primary"
          >
            Keenthemes Inc.
          </a>
          <span>&nbsp; &nbsp; | &nbsp; </span>
          <Link to="/" className="text-secondary-foreground hover:text-primary">
            {strVersion}
          </Link>
        </span>
      </div>
      <div className="small-logo order-2 order-md-1">
        <span className="text-muted-foreground text-sm">{strVersion}</span>
      </div>
    </div >
  );
}
