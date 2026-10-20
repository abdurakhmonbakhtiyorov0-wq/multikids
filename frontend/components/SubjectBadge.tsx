import { SUBJECT_BY_ID, type Subject } from "@/lib/data";

/** Fan belgisi: boshlang‘ich modulda emoji, jiddiy modullarda qisqa yozuv (Mat, Alg, Fiz…). */
export function SubjectBadge({ subject, kids }: { subject: Subject; kids: boolean }) {
  const s = SUBJECT_BY_ID[subject];
  if (kids) return <span aria-hidden>{s.emoji}</span>;
  return (
    <span aria-hidden className="inline-grid min-w-8 place-items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-black leading-none text-blue-800">
      {s.abbr}
    </span>
  );
}
