import chemistry from "./chemistry.js";
import chemistryMore from "./chemistry-more.js";
import biology from "./biology.js";
import biologyMore from "./biology-more.js";
import physics from "./physics.js";
import physicsMore from "./physics-more.js";
import informatics from "./informatics.js";
import informaticsMore from "./informatics-more.js";
import english from "./english.js";
import englishMore from "./english-more.js";
import satReading from "./sat-reading.js";

// Yangi modullar (5–11-sinf va SAT) uchun qo‘lda yozilgan savollar: fan -> sinf -> [[daraja, savol, javob, [noto‘g‘ri], izoh]].
// Hisoblab yaratiladigan matematik savollar generated-modules.js da.
// Tarix, geografiya, adabiyot va ona tili o‘quv kitobi bilan solishtirib tekshirilishi kerak, shuning uchun hozircha yo‘q.
const merge = (...parts) => Object.assign({}, ...parts);

export default {
  chemistry: merge(chemistry, chemistryMore),
  biology: merge(biology, biologyMore),
  physics: merge(physics, physicsMore),
  informatics: merge(informatics, informaticsMore),
  english: merge(english, englishMore),
  "sat-reading": satReading,
};
