import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { BellRing, CheckCheck, LoaderCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  NotificationDto,
  getErrorMessage,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/hospital-api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = () => {
    setLoading(true);
    getNotifications()
      .then(({ data }) => setNotifications(data))
      .catch(() => notify('Αποτυχία φόρτωσης ειδοποιήσεων.', 'error', 4000))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function handleMarkRead(notification: NotificationDto) {
    if (notification.isRead) return;
    try {
      await markNotificationRead(notification.notificationId);
      setNotifications((list) => list.map((n) => (n.notificationId === notification.notificationId ? { ...n, isRead: true } : n)));
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενέργεια απέτυχε.'), 'error', 4000);
    }
  }

  async function handleMarkAllRead() {
    setMarking(true);
    try {
      await markAllNotificationsRead();
      setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
      window.dispatchEvent(new Event('notifications-changed'));
      notify('Όλες οι ειδοποιήσεις σημάνθηκαν ως αναγνωσμένες.', 'success', 2500);
    } catch (err) {
      notify(getErrorMessage(err, 'Η ενέργεια απέτυχε.'), 'error', 4000);
    } finally {
      setMarking(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ειδοποιήσεις</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} μη αναγνωσμένες ειδοποιήσεις.` : 'Όλες οι ειδοποιήσεις έχουν αναγνωσθεί.'}
          </p>
        </div>
        <Button variant="outline" disabled={marking || unreadCount === 0} onClick={handleMarkAllRead}>
          <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Σήμανση όλων ως αναγνωσμένα
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Όλες οι ειδοποιήσεις</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><LoaderCircleIcon className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <BellRing className="h-6 w-6" />
              <p className="text-sm">Δεν υπάρχουν ειδοποιήσεις.</p>
            </div>
          ) : (
            <DataGrid
              dataSource={notifications}
              keyExpr="notificationId"
              showBorders
              columnAutoWidth
              wordWrapEnabled
              noDataText="Δεν υπάρχουν ειδοποιήσεις."
              onRowClick={({ data }: { data: NotificationDto }) => handleMarkRead(data)}
            >
              <FilterRow visible />
              <HeaderFilter visible />
              <Paging defaultPageSize={20} />
              <Pager visible showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo showNavigationButtons />
              <Column
                caption=""
                width={40}
                cellRender={({ data }: { data: NotificationDto }) => (!data.isRead ? <div className="h-2 w-2 rounded-full bg-primary" /> : null)}
              />
              <Column dataField="createdAt" caption="Ημ/νία" width={150} calculateCellValue={(row: NotificationDto) => format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm')} />
              <Column dataField="title" caption="Τίτλος" width={220} cellRender={({ data }: { data: NotificationDto }) => <span className={data.isRead ? '' : 'font-semibold'}>{data.title}</span>} />
              <Column dataField="body" caption="Μήνυμα" />
              <Column
                dataField="isRead"
                caption="Κατάσταση"
                width={130}
                cellRender={({ data }: { data: NotificationDto }) => (
                  <Badge variant={data.isRead ? 'outline' : 'info'} size="sm">{data.isRead ? 'Αναγνωσμένη' : 'Νέα'}</Badge>
                )}
              />
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
