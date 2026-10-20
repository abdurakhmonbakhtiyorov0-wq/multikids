"use client";

import { useEffect, useState } from "react";
import { API_URL } from "./api";
import { MODULES, SUBJECTS, type Grade, type ModuleId, type Subject } from "./data";

// O‘quv dasturi serverdan olinadi (/api/curriculum): qaysi sinfda qaysi fan bor va savollari tayyormi.
export type CurriculumSubject = { id: Subject; questions: number; ready: boolean };
export type CurriculumGrade = { grade: Grade; subjects: CurriculumSubject[] };
export type Curriculum = { modules: { id: ModuleId; grades: CurriculumGrade[] }[] };

let cache: Curriculum | null = null;
let inflight: Promise<Curriculum | null> | null = null;

function load(): Promise<Curriculum | null> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch(`${API_URL}/api/curriculum`)
    .then((r) => (r.ok ? (r.json() as Promise<Curriculum>) : null))
    .catch(() => null)
    .then((c) => {
      cache = c;
      inflight = null;
      return c;
    });
  return inflight;
}

/** Server javob bermasa: boshlang‘ich modulning 6 ta fani ko‘rsatiladi, boshqa sinflar uchun bo‘sh ro‘yxat. */
const FALLBACK_JUNIOR: Subject[] = ["mathematics", "native-language", "reading", "natural-science", "english", "russian"];

export function useCurriculum() {
  const [data, setData] = useState<Curriculum | null>(cache);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    load().then((c) => {
      if (!live) return;
      if (c) setData(c);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const grades = (module: ModuleId): Grade[] => data?.modules.find((m) => m.id === module)?.grades.map((g) => g.grade) ?? MODULES.find((m) => m.id === module)!.grades;

  /** Sinfdagi fanlar (server tartibida). `ready=false` — savollar hali yetarli emas ("Tez orada"). */
  const subjects = (grade: Grade | null | undefined): (CurriculumSubject & { meta: (typeof SUBJECTS)[number] })[] => {
    if (!grade) return [];
    const found = data?.modules.flatMap((m) => m.grades).find((g) => g.grade === grade)?.subjects;
    const list: CurriculumSubject[] = found ?? (failed && grade <= 4 ? FALLBACK_JUNIOR.map((id) => ({ id, questions: 0, ready: true })) : []);
    return list.map((s) => ({ ...s, meta: SUBJECTS.find((x) => x.id === s.id)! })).filter((s) => s.meta);
  };

  return { data, loading: !data && !failed, failed, grades, subjects };
}
