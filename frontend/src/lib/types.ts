export type HabitStatus = "LOCKED" | "ACTIVE" | "VALID";

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  totalPoints: number;
  level: number;
  timezone: string;
  reminderHour: number;
}

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  basePoints: number;
  requiredStreak: number;
  status: HabitStatus;
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
  prerequisiteIds?: number[];
}

export interface TodayEntry {
  habitId: number;
  name: string;
  description: string | null;
  status: HabitStatus;
  currentStreak: number;
  requiredStreak: number;
  basePoints: number;
  multiplier: number;
  todayStatus: "DONE" | "MISSED" | "PENDING";
}

export interface TodayResponse {
  date: string;
  allChecked: boolean;
  pointsToday: number;
  entries: TodayEntry[];
}

export interface CheckinResult {
  earnedPoints: number;
  totalPoints: number;
  level: number;
  becameValid: string[];
  unlocked: string[];
}

export interface HistoryDay {
  date: string;
  done: number;
  missed: number;
  points: number;
}
