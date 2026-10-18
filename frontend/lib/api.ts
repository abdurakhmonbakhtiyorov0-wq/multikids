import type { Grade, MascotId, RewardId, Subject } from "./data";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "bilimdon-token";

export type Profile = { mascot: MascotId | null; grade: Grade | null; subject: Subject | null };
export type User = { id: string; name: string; email: string; profile: Profile; createdAt: string };

export type QuizQuestion = { id: string; prompt: string; options: string[]; difficulty: string };
export type QuizState = { answered: number; correct: number; incorrect: number; score: number; streak: number; equipped: RewardId[]; earned: RewardId[] };
export type RewardEvent = { type: "equip"; item: RewardId } | { type: "remove"; item: RewardId | null } | { type: "celebrate" };
export type AnswerResult = { correct: boolean; correctIndex: number; explanation: string; event: RewardEvent; state: QuizState };
export type ReviewAnswer = { questionId: string; prompt: string; options: string[]; chosen: number; correctIndex: number; explanation: string };
export type QuizResult = {
  id: string;
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
export type Progress = {
  totalPoints: number;
  quizzes: number;
  totalCorrect: number;
  bySubject: Record<Subject, { attempts: number; bestScore: number; avgAccuracy: number }>;
  rewards: RewardId[];
  achievements: { id: string; title: string; description: string; unlocked: boolean }[];
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
