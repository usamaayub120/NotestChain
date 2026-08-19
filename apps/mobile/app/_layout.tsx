import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { initialiseOfflineStore } from "@/src/lib/offline";
import { syncQueuedMutations } from "@/src/lib/sync";

const client = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    initialiseOfflineStore();
    void syncQueuedMutations();
    return NetInfo.addEventListener((state) => { if (state.isConnected) void syncQueuedMutations(); });
  }, []);
  return <QueryClientProvider client={client}><Stack screenOptions={{ headerBackTitle: "Back", headerTintColor: "#44403c" }} /></QueryClientProvider>;
}
