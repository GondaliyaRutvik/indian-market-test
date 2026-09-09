/**
 * NSE trading session helpers. Everything is evaluated in Asia/Kolkata regardless
 * of where the server actually runs (Vercel runs UTC, your laptop does not).
 */

const IST = "Asia/Kolkata";

export type IstNow = {
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  hour: number;
  minute: number;
  /** Minutes since midnight IST */
  minutesOfDay: number;
  /** YYYY-MM-DD in IST, useful as a "trading day" key */
  dateKey: string;
  /** e.g. "09 Sep 2026, 2:31 pm" */
  pretty: string;
};

export function istNow(at: Date = new Date()): IstNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    weekday: weekdayMap[get("weekday")] ?? 0,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    pretty: new Intl.DateTimeFormat("en-IN", {
      timeZone: IST,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(at),
  };
}

const OPEN_MIN = 9 * 60 + 15;   // 09:15 IST
const CLOSE_MIN = 15 * 60 + 30; // 15:30 IST

/**
 * True during the NSE equity session. This deliberately does not know about
 * trading holidays — on a holiday Yahoo simply keeps returning the previous
 * close, so changePct stays ~0 and no alert fires anyway.
 */
export function isMarketOpen(at: Date = new Date()): boolean {
  const n = istNow(at);
  if (n.weekday === 0 || n.weekday === 6) return false;
  return n.minutesOfDay >= OPEN_MIN && n.minutesOfDay <= CLOSE_MIN;
}

export function marketStatus(at: Date = new Date()): {
  open: boolean;
  label: string;
  detail: string;
} {
  const n = istNow(at);
  if (n.weekday === 0 || n.weekday === 6) {
    return { open: false, label: "Closed", detail: "Weekend — NSE reopens Monday 9:15 am IST" };
  }
  if (n.minutesOfDay < OPEN_MIN) {
    return { open: false, label: "Pre-open", detail: "NSE opens at 9:15 am IST" };
  }
  if (n.minutesOfDay > CLOSE_MIN) {
    return { open: false, label: "Closed", detail: "NSE closed at 3:30 pm IST" };
  }
  return { open: true, label: "Live", detail: "NSE session in progress" };
}

export function formatIst(d: Date): string {
  return istNow(d).pretty;
}
