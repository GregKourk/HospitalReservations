import { ReactNode, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { BellRing, CheckCheck, LoaderCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import notify from 'devextreme/ui/notify';
import {
  NotificationDto,
  getErrorMessage,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/hospital-api';

export function NotificationsSheet({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getNotifications(false, 30)
      .then(({ data }) => setNotifications(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  // Live update: SignalRService dispatches this whenever the hub pushes a
  // "Notification" event to this user's personal group.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.event === 'Notification' && open) load();
    };
    window.addEventListener('signalr-update', handler);
    return () => window.removeEventListener('signalr-update', handler);
  }, [open]);

  async function handleItemClick(n: NotificationDto) {
    if (n.isRead) return;
    try {
      await markNotificationRead(n.notificationId);
      setNotifications((list) => list.map((x) => (x.notificationId === n.notificationId ? { ...x, isRead: true } : x)));
      window.dispatchEvent(new Event('notifications-changed'));
    } catch {
      // best-effort — not worth surfacing an error toast for a read-marker
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενέργεια απέτυχε.'), 'error', 4000);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="p-0 gap-0 sm:w-[420px] sm:max-w-none inset-5 start-auto h-auto rounded-lg [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5">
        <SheetHeader className="mb-0">
          <SheetTitle className="p-3">
            Ειδοποιήσεις {unreadCount > 0 && <span className="text-muted-foreground font-normal">({unreadCount} νέες)</span>}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="grow p-0">
          <ScrollArea className="h-[calc(100vh-13rem)]">
            {loading ? (
              <div className="flex justify-center py-10"><LoaderCircleIcon className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <BellRing className="h-6 w-6" />
                <p className="text-sm">Δεν υπάρχουν ειδοποιήσεις.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((n) => (
                  <button
                    key={n.notificationId}
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className="flex items-start gap-2.5 text-start px-5 py-3 border-b hover:bg-accent transition-colors"
                  >
                    <div className="mt-1.5 shrink-0">
                      {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm truncate ${n.isRead ? '' : 'font-semibold'}`}>{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: el })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetBody>
        <SheetFooter className="border-t border-border p-5 grid grid-cols-2 gap-2.5">
          <Button variant="outline" asChild>
            <Link to="/admin/notifications" onClick={() => setOpen(false)}>Όλες οι ειδοποιήσεις</Link>
          </Button>
          <Button variant="outline" disabled={unreadCount === 0} onClick={handleMarkAllRead}>
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Σήμανση όλων
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
