import chemistry from "./chemistry.js";
import biology from "./biology.js";
import physics from "./physics.js";
import informatics from "./informatics.js";
import english from "./english.js";
import satReading from "./sat-reading.js";

// Yangi modullar (5–11-sinf va SAT) uchun qo‘lda yozilgan savollar: fan -> sinf -> [[daraja, savol, javob, [noto‘g‘ri], izoh]].
// Hisoblab yaratiladigan matematik savollar generated-modules.js da.
export default {
  chemistry,
  biology,
  physics,
  informatics,
  english,
  "sat-reading": satReading,
};
