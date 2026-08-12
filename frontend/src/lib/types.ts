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
  /** QUIT habits only: the BUILD habit done in its place. */
  replacementHabitId: number | null;
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
  /** null clears the pairing. */
  replacementHabitId?: number | null;
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
  /** QUIT habits: the habit to do instead, if one is paired. */
  replacementHabitId: number | null;
  replacementName: string | null;
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
  /** The habit to reach for instead, if one is paired. */
  replacementHabitId: number | null;
  replacementName: string | null;
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
  /** Pairs completed today, as "bad habit → replacement". */
  swaps: string[];
}

export interface HistoryDay {
  date: string;
  done: number;
  missed: number;
  points: number;
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

/** The ticking clock face: days alongside a padded hh:mm:ss. */
export function formatClock(seconds: number): { days: number; time: string } {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    days: Math.floor(s / DAY),
    time: `${pad(Math.floor((s % DAY) / HOUR))}:${pad(Math.floor((s % HOUR) / 60))}:${pad(s % 60)}`,
  };
}
