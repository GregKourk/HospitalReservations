import { isSignalRConnected, StartSignalR } from "./signalRService";

export const loadConfig = async () :Promise<void> => {
  if (!isSignalRConnected()){
    StartSignalR();
  }
}