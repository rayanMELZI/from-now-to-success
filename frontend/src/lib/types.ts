export type HabitStatus = "LOCKED" | "ACTIVE" | "VALID";
export type HabitSchedule = "DAILY" | "WEEKLY" | "MONTHLY";
export type HabitType = "BUILD" | "QUIT";

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
  timesPerPeriod: number;
  status: HabitStatus;
  gauge: number;
  currentStreak: number;
  bestStreak: number;
  consecutiveMisses: number;
  startDate: string;
  prerequisiteIds: number[];
}

export interface HabitRequest {
  name: string;
  description?: string;
  basePoints?: number;
  requiredStreak?: number;
  schedule?: HabitSchedule;
  habitType?: HabitType;
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

export interface TodayResponse {
  date: string;
  allChecked: boolean;
  pointsToday: number;
  freezesLeft: number;
  deepFreezesLeft: number;
  entries: TodayEntry[];
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
