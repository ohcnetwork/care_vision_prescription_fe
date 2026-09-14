import * as React from "react";

// Resolve the federation-shared React at call time.
export function useSyncExternalStore<Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: () => Snapshot,
): Snapshot {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default { useSyncExternalStore };
