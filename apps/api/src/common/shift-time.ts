/** Local clock (date + minutes since midnight) in a given IANA timezone. */
export function localClock(timeZone: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function addDays(date: string, delta: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Finds the shift running right now. For overnight shifts (e.g. 22:00-06:00) the
 * "business date" after midnight is the previous calendar day (the day the shift started).
 */
export function findCurrentShift<T extends { startsAt: string; endsAt: string }>(
  shifts: T[],
  clock: { date: string; minutes: number },
): { shift: T; businessDate: string } | null {
  for (const shift of shifts) {
    const start = toMinutes(shift.startsAt);
    const end = toMinutes(shift.endsAt);
    if (start < end) {
      if (clock.minutes >= start && clock.minutes < end) {
        return { shift, businessDate: clock.date };
      }
    } else {
      if (clock.minutes >= start) return { shift, businessDate: clock.date };
      if (clock.minutes < end) return { shift, businessDate: addDays(clock.date, -1) };
    }
  }
  return null;
}