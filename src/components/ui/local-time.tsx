'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Formats a timestamp in the viewer's own time zone. Server render shows UTC until hydration. */
export function LocalTime({ ms }: { ms: number }) {
  const local = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const text = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    timeZoneName: 'short',
    timeZone: local ? undefined : 'UTC',
  }).format(ms);
  return <time dateTime={new Date(ms).toISOString()}>{text}</time>;
}
