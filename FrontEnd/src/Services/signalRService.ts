import { getAuth } from "@/auth/lib/helpers";
//import axios from "axios";
import notify from "devextreme/ui/notify";
import { HubConnectionBuilder, HubConnection, HubConnectionState } from "@microsoft/signalr";

let connection: HubConnection | null = null;
const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_SIGNALR_API_LOCAL_URL          
  : `${import.meta.env.VITE_API_URL}/SignalRHub`;      

export const StartSignalR = () => {
  if (connection && connection.state === HubConnectionState.Connected) return;

  // if a stale/disconnected connection exists, clean it up first
  if (connection) {
    connection.stop();
    connection = null;
  }

  connection = new HubConnectionBuilder()
    .withUrl(API_BASE_URL, {
      accessTokenFactory: () => getAuth()?.token ?? "",
    })
    .withAutomaticReconnect()
    .build();

  connection.start().then(() => {

  const events = ["TravelSheetUpdated", "BudgetAlert", "ApprovalRequired", "HRMCommunicationUpdate", "NewAdminMessage", "NewMessageReply", "NewDeleteMessage", "FiscalYearUpdated", "TenantUpdated"
    , "GenikesUpdated", "SettingsUpdated", "Notification"
  ]

  events.forEach((eventName) => {
    connection?.on(eventName, (data) => {
      // Show a toast for whichever shape of payload this event actually carries —
      // generic ops events use "message", but NotificationHelper's own "Notification"
      // event (the one that drives the topbar bell) sends "title"/"body" instead, so
      // that real user-facing notification was never actually toasting until now.
      const toastMessage = data.message ?? (data.title || data.body ? `${data.title ?? ''}${data.title && data.body ? ' — ' : ''}${data.body ?? ''}` : null);
      if (toastMessage) {
        notify({
          message: toastMessage,
          type: data.notifyType ?? 'info',
          displayTime: data.displayTime ?? 4000,
          position: { at: 'bottom right', my: 'bottom right', offset: '-20 -20' },
          width: 320,
          closeOnClick: true,
        })
      }

      // Dispatch a single generic event with the event name included
      window.dispatchEvent(new CustomEvent('signalr-update', {
        detail: { ...data, event: eventName }
      }))
    })
  })

}).catch((err) => console.error("SignalR Connection Error: ", err))
};

export const stopSignalR = () => {
  if (connection) {
    connection.stop();
    connection = null;
  }
};

export const isSignalRConnected = () =>
  connection?.state === HubConnectionState.Connected;