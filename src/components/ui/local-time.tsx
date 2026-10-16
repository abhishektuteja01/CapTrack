'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Formats a timestamp in the viewer's own time zone. Server render shows UTC until hydration.
 * Built from parts, not `format()`: Node and browsers ship different ICU data and join the
 * pieces differently ("16 Oct, 00:41" vs "16 Oct at 00:41"), which breaks hydration.
 */
export function LocalTime({ ms }: { ms: number }) {
  const local = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    day: 'numeric',
    month: 'short',
    timeZoneName: 'short',
    timeZone: local ? undefined : 'UTC',
  }).formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const text = `${get('day')} ${get('month')}, ${get('hour')}:${get('minute')} ${get('timeZoneName')}`;
  return <time dateTime={new Date(ms).toISOString()}>{text}</time>;
}
