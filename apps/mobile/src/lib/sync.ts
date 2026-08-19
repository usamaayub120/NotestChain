import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";
import { queued, removeQueued } from "./offline";

/** Replays reversible mutations in order. Publishing is intentionally absent. */
export async function syncQueuedMutations() {
  if (!(await NetInfo.fetch()).isConnected) return;
  const pending = queued();
  for (const item of pending) {
    if (item.dependencyId && pending.some((candidate) => candidate.id === item.dependencyId)) continue;
    await api(item.path, { method: item.method, body: JSON.stringify(item.body), idempotencyKey: item.id });
    removeQueued(item.id);
  }
}
