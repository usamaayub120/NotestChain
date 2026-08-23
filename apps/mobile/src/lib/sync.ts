import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";
import { queued, removeQueued } from "./offline";

let replaying = false;

/** Replays reversible mutations in order. Publishing is intentionally absent. */
export async function syncQueuedMutations() {
  // Called from both mount and every NetInfo reconnect event — without this
  // guard, two overlapping replays could double-send the same mutation.
  if (replaying) return;
  replaying = true;
  try {
    if (!(await NetInfo.fetch()).isConnected) return;
    const pending = queued();
    const succeeded = new Set<string>();
    for (const item of pending) {
      const dependencyStillPending = item.dependencyId && pending.some((candidate) => candidate.id === item.dependencyId) && !succeeded.has(item.dependencyId);
      if (dependencyStillPending) continue;
      try {
        await api(item.path, { method: item.method, body: JSON.stringify(item.body), idempotencyKey: item.id });
        removeQueued(item.id);
        succeeded.add(item.id);
      } catch {
        // One permanently-failing mutation must not block every mutation
        // queued after it — leave it queued and retry on the next pass.
      }
    }
  } finally {
    replaying = false;
  }
}
