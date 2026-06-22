import { EventEmitter } from 'node:events';

// In-process pub/sub for live floor updates. A store-scoped channel is signalled
// whenever something that changes the floor happens (order placed, tab settled /
// cancelled / moved / combined, pax set, item voided). The SSE endpoint forwards
// the signal to that store's connected admin clients, which then refetch the floor.
//
// Single-process only — fine for one API instance. To scale horizontally, back
// this with Redis pub/sub (same emit/subscribe surface).
const emitter = new EventEmitter();
// Many concurrent SSE subscribers per store + several stores → lift the default
// 10-listener warning cap.
emitter.setMaxListeners(0);

const channel = (storeId: string) => `floor:${storeId}`;

export const floorEvents = {
  /** Signal that `storeId`'s floor changed. Best-effort; never throws. */
  emit(storeId: string): void {
    if (storeId) emitter.emit(channel(storeId));
  },
  /** Subscribe to a store's floor changes. Returns an unsubscribe function. */
  subscribe(storeId: string, listener: () => void): () => void {
    const ch = channel(storeId);
    emitter.on(ch, listener);
    return () => emitter.off(ch, listener);
  },
};
