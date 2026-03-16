export function toIsoDate(value?: string | null) {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function normalizeTime(value?: string | null) {
  if (!value) return null;
  const trimmed = value.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

export function compareIsoDate(a: string, b: string) {
  return a.localeCompare(b);
}

export function formatTimeRange(startTime?: string | null, endTime?: string | null) {
  const from = normalizeTime(startTime);
  const to = normalizeTime(endTime);
  if (from && to) return `${from} - ${to}`;
  if (from) return `${from} - ?`;
  if (to) return `? - ${to}`;
  return 'Todo el dia';
}

export function formatAgendaTimeLabel(startTime?: string | null, endTime?: string | null) {
  const from = normalizeTime(startTime);
  const to = normalizeTime(endTime);
  if (from && to) return `${from} a ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return 'Todo el dia';
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function rangesOverlap(
  startA?: string | null,
  endA?: string | null,
  startB?: string | null,
  endB?: string | null
) {
  const aStart = normalizeTime(startA);
  const aEnd = normalizeTime(endA);
  const bStart = normalizeTime(startB);
  const bEnd = normalizeTime(endB);

  if (!aStart && !aEnd) return true;
  if (!bStart && !bEnd) return true;

  const startMinutesA = timeToMinutes(aStart ?? '00:00');
  const endMinutesA = timeToMinutes(aEnd ?? '23:59');
  const startMinutesB = timeToMinutes(bStart ?? '00:00');
  const endMinutesB = timeToMinutes(bEnd ?? '23:59');

  return startMinutesA < endMinutesB && startMinutesB < endMinutesA;
}

export function dateRangesOverlap(
  startA?: string | null,
  endA?: string | null,
  startB?: string | null,
  endB?: string | null
) {
  const fromA = toIsoDate(startA);
  const toA = toIsoDate(endA ?? startA);
  const fromB = toIsoDate(startB);
  const toB = toIsoDate(endB ?? startB);

  if (!fromA || !toA || !fromB || !toB) return false;
  return compareIsoDate(fromA, toB) <= 0 && compareIsoDate(fromB, toA) <= 0;
}

export function eventTouchesDay(
  targetIso: string,
  startDate?: string | null,
  endDate?: string | null
) {
  const from = toIsoDate(startDate);
  const to = toIsoDate(endDate ?? startDate);
  if (!from || !to) return false;
  return compareIsoDate(from, targetIso) <= 0 && compareIsoDate(targetIso, to) <= 0;
}
