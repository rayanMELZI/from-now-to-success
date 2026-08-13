export type HabitStatus = "LOCKED" | "ACTIVE" | "VALID";
export type HabitSchedule = "DAILY" | "WEEKLY" | "MONTHLY";
export type HabitType = "BUILD" | "QUIT";
/** How a habit is tracked: answered at check-in, or a clock you reset. */
export type TrackingMode = "SCHEDULED" | "TIMER";

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  totalPoints: number;
  level: number;
  timezone: string;
  reminderHour: number;
  dayEndHour: number;
  weekStartDay: number;
  /** Opt-in: reveals the daily plan page and its nav tab. */
  plannerEnabled: boolean;
}

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  basePoints: number;
  requiredStreak: number;
  schedule: HabitSchedule;
  habitType: HabitType;
  trackingMode: TrackingMode;
  /** TIMER only: the clean duration that validates the habit. */
  goalSeconds: number | null;
  /** TIMER only: when the running clock started. */
  clockStartedAt: string | null;
  /** TIMER only: the longest run ever. */
  bestCleanSeconds: number;
  timesPerPeriod: number;
  status: HabitStatus;
  gauge: number;
  currentStreak: number;
  bestStreak: number;
  consecutiveMisses: number;
  startDate: string;
  sortOrder: number;
  prerequisiteIds: number[];
}

export interface HabitRequest {
  name: string;
  description?: string;
  basePoints?: number;
  requiredStreak?: number;
  schedule?: HabitSchedule;
  habitType?: HabitType;
  trackingMode?: TrackingMode;
  goalSeconds?: number;
  timesPerPeriod?: number;
  prerequisiteIds?: number[];
}

export interface TodayEntry {
  habitId: number;
  name: string;
  description: string | null;
  status: HabitStatus;
  schedule: HabitSchedule;
  habitType: HabitType;
  gauge: number;
  currentStreak: number;
  requiredStreak: number;
  basePoints: number;
  multiplier: number;
  daysLeftInPeriod: number;
  timesPerPeriod: number;
  doneThisPeriod: number;
  todayStatus: "DONE" | "MISSED" | "PENDING" | "DONE_TODAY" | "FROZEN";
}

export interface TimerEntry {
  habitId: number;
  name: string;
  description: string | null;
  status: HabitStatus;
  habitType: HabitType;
  clockStartedAt: string;
  goalSeconds: number;
  bestCleanSeconds: number;
  /** The rung being climbed now; 0 once the goal is behind you. */
  nextMilestoneSeconds: number;
  gauge: number;
  requiredStreak: number;
  basePoints: number;
}

export interface TodayResponse {
  date: string;
  /** Lets the client correct a device clock that disagrees with the server. */
  serverNow: string;
  allChecked: boolean;
  pointsToday: number;
  freezesLeft: number;
  deepFreezesLeft: number;
  entries: TodayEntry[];
  timers: TimerEntry[];
}

export interface FallResult {
  earnedPoints: number;
  totalPoints: number;
  level: number;
  lastRunSeconds: number;
  bestCleanSeconds: number;
  newRecord: boolean;
  relocked: string[];
}

export interface TimerRun {
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  milestonesHit: number;
  reason: string | null;
}

export interface CheckinResult {
  earnedPoints: number;
  totalPoints: number;
  level: number;
  freezesLeft: number;
  deepFreezesLeft: number;
  becameValid: string[];
  unlocked: string[];
}

export interface HistoryDay {
  date: string;
  done: number;
  missed: number;
  points: number;
}

/** One line of the daily plan: a start time and what happens then. */
export interface PlanBlock {
  id: number;
  date: string;
  /** Minutes since midnight, 0..1439. */
  startMinute: number;
  title: string;
  /** The habit this block stands for, if it was picked from the roadmap. */
  habitId: number | null;
  /** The linked habit's current name — it may have been renamed since. */
  habitName: string | null;
  done: boolean;
}

export interface PlanDay {
  date: string;
  /** The user's logical today, so the client can label the day it shows. */
  today: string;
  /** The most recent earlier day that has a plan, or null. */
  lastPlannedDate: string | null;
  blocks: PlanBlock[];
}

export interface PlanBlockRequest {
  title: string;
  startMinute: number;
  habitId?: number | null;
}

/** Wording flips for QUIT habits: success = avoiding it. */
export function habitVerbs(type: HabitType) {
  return type === "QUIT"
    ? { did: "Avoided it", missed: "Relapsed", question: "avoid" }
    : { did: "Did it", missed: "Missed", question: "do" };
}

export const scheduleLabel: Record<HabitSchedule, string> = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

const HOUR = 3600;
const DAY = 24 * HOUR;

/** Goals offered in the form; anything in between is reachable with the stepper. */
export const GOAL_PRESETS: { label: string; seconds: number }[] = [
  { label: "1 day", seconds: DAY },
  { label: "1 week", seconds: 7 * DAY },
  { label: "1 month", seconds: 30 * DAY },
  { label: "3 months", seconds: 90 * DAY },
  { label: "1 year", seconds: 365 * DAY },
];

/** Short and human: "12d 4h", "4h 21m", "45s". Never more than two units. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / DAY);
  const hours = Math.floor((s % DAY) / HOUR);
  const minutes = Math.floor((s % HOUR) / 60);

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${s}s`;
}

const MINUTES_IN_DAY = 24 * 60;

/** Minutes since midnight as a clock face: 730 → "12:10". */
export function formatMinute(minute: number): string {
  const m = ((Math.round(minute) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "12:10" → 730. Returns null for anything that is not a clock face. */
export function parseMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** How long a block lasts, worded for the timeline: "10 min", "1h 30". */
export function formatGap(minutes: number): string {
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, "0")}`;
}

/** The ticking clock face: days alongside a padded hh:mm:ss. */
export function formatClock(seconds: number): { days: number; time: string } {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    days: Math.floor(s / DAY),
    time: `${pad(Math.floor((s % DAY) / HOUR))}:${pad(Math.floor((s % HOUR) / 60))}:${pad(s % 60)}`,
  };
}
