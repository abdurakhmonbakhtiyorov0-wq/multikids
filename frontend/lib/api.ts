import type { Grade, MascotId, RewardId, Subject } from "./data";

// Ishlab chiqarishda NEXT_PUBLIC_API_URL majburiy (Vercel loyihasi sozlamalarida). Faqat lokal ishlab chiqishda localhost:4000 ishlatiladi.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname !== "localhost" ? "" : "http://localhost:4000");
const TOKEN_KEY = "bilimdon-token";

export type Profile = { mascot: MascotId | null; grade: Grade | null; subject: Subject | null };
export type ChildInfo = {
  id: string;
  locale: "uz" | "ru";
  soundEnabled: boolean;
  voiceAutoplay: boolean;
  timezone: string;
  balance: number;
  xp: number;
  level: number;
  levelTitle: string;
  equipped: RewardId[];
  levelFloorXp: number;
  levelCeilXp: number;
  streak: number;
  bestStreak: number;
};
export type User = { id: string; name: string; email: string; profile: Profile; createdAt: string; child?: ChildInfo };

export type QuizQuestion = { id: string; prompt: string; options: string[]; difficulty: string; topic?: string; image?: { src: string; alt: string } | null };
export type QuizMode = "quiz" | "mistakes" | "exam";
export type TestId = "level-1" | "level-2" | "level-3" | "level-4" | "level-5" | "mixed" | "exam";
export type TestInfo = {
  id: TestId;
  kind: "level" | "mixed" | "exam";
  order: number;
  title: string;
  label: string;
  note: string;
  total: number;
  pointsPerCorrect: number;
  timeLimitSec: number | null;
  available: boolean;
  unlocked: boolean;
  lockedReason: string | null;
  attempts: number;
  bestAccuracy: number | null;
  bestScore: number | null;
  bestMark: number | null;
  inProgress: { answered: number; total: number } | null;
};
export type QuizSession = { sessionId: string; mode: QuizMode; testId: TestId | "mistakes"; testTitle: string; pointsPerCorrect: number; deadlineAt: string | null; serverNow: string; total: number; index: number; question: QuizQuestion | null; state: QuizState; resumed: boolean };
export type QuizState = { answered: number; correct: number; incorrect: number; score: number; streak: number; equipped: RewardId[]; earned: RewardId[] };
export type RewardEvent = { type: "equip"; item: RewardId } | { type: "remove"; item: RewardId | null } | { type: "celebrate" };
export type AnswerResult = { correct: boolean; correctIndex: number; explanation: string; event: RewardEvent; state: QuizState; next: QuizQuestion | null; total?: number };
export type ReviewAnswer = { questionId: string; prompt: string; options: string[]; chosen: number; correctIndex: number; explanation: string };
export type QuizResult = {
  id: string;
  mode?: QuizMode;
  testId?: string;
  testTitle?: string;
  mark?: number | null;
  xp?: number;
  grade: Grade;
  subject: Subject;
  total: number;
  correct: number;
  incorrect: number;
  score: number;
  maxScore: number;
  accuracy: number;
  bestStreak: number;
  equipped: RewardId[];
  earned: RewardId[];
  durationSec: number;
  createdAt: string;
  answers?: ReviewAnswer[];
};
export type ShopItem = { id: RewardId; category: string; name: string; price: number; minLevel: number; owned: boolean; equipped: boolean; levelLocked: boolean; affordable: boolean };
export type ShopData = { balance: number; level: number; items: ShopItem[] };
export type NewAchievement = { id: string; title: string; description: string; rewardPoints?: number };
export type DailyData = {
  day: string;
  points: number;
  question: QuizQuestion;
  answered: boolean;
  result: { correct: boolean; chosen: number; correctIndex: number; explanation: string; earned: number } | null;
  newAchievements?: NewAchievement[];
};
export type WeeklyTask = { id: string; title: string; target: number; progress: number; reward: number; complete: boolean; claimed: boolean };
export type WeeklyData = { weekStart: string; tasks: WeeklyTask[]; allClaimed: boolean; earned?: number; newAchievements?: NewAchievement[] };
export type HeroInfo = { id: MascotId; unlocked: boolean; requirement: string | null };
export type Settings = { name?: string; locale?: "uz" | "ru"; soundEnabled?: boolean; voiceAutoplay?: boolean; timezone?: string };

export type Progress = {
  totalPoints: number;
  quizzes: number;
  totalCorrect: number;
  bySubject: Record<Subject, { attempts: number; bestScore: number; avgAccuracy: number; mistakesToReview?: number }>;
  rewards: RewardId[];
  achievements: { id: string; title: string; description: string; unlocked: boolean }[];
  balance?: number;
  xp?: number;
  level?: number;
  streak?: number;
  bestStreak?: number;
  dailyGoal?: { goal: number; done: number; met: boolean };
  recent: QuizResult[];
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!API_URL) throw new ApiError("Backend manzili sozlanmagan (NEXT_PUBLIC_API_URL).", 0);
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Server bilan bog‘lanib bo‘lmadi. Backend ishga tushirilganini tekshiring.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Kutilmagan xatolik yuz berdi", res.status);
  return data as T;
}
