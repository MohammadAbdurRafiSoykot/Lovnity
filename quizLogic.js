// quizlogic.js
// Pure quiz logic + configuration. No DOM. No Supabase.

export const CLASS_META = {
  1: { label: "Communication" },
  2: { label: "Trust and Betrayal" },
  3: { label: "Sex and intimacy" },
};

export const QUIZ_ITEMS = [
  { id: "communication", label: "Communication", classId: 1 },
  { id: "everyday", label: "Everyday (household chores, responsibilities, schedules)", classId: 1 },
  { id: "trust", label: "Trust", classId: 2 },
  { id: "difference", label: "Difference", classId: 2 },
  { id: "conflicts", label: "Conflicts and problems Handling", classId: 1 },
  { id: "emotional_intimacy", label: "Emotional Intimacy", classId: 3 },
  { id: "physical_intimacy", label: "Physical Intimacy and Sexuality", classId: 3 },
  { id: "respect", label: "Respecting each other", classId: 1 },
];

// Slider scale
export const SLIDER_MIN = 1;
export const SLIDER_MAX = 10;
export const SLIDER_STEP = 1;
export const SLIDER_DEFAULT = 5;

/**
 * Scores answers:
 * - sum per class
 * - average per class
 * - winner = class with highest avg (tie-break: sum desc, then classId asc)
 */
export function scoreQuiz(answers) {
  const agg = {
    1: { sum: 0, count: 0 },
    2: { sum: 0, count: 0 },
    3: { sum: 0, count: 0 },
  };

  for (const item of QUIZ_ITEMS) {
    const v = Number(answers?.[item.id] ?? 0);
    agg[item.classId].sum += v;
    agg[item.classId].count += 1;
  }

  const classResults = Object.keys(agg).map((k) => {
    const classId = Number(k);
    const sum = agg[classId].sum;
    const count = agg[classId].count;
    const avg = count ? sum / count : 0;

    return { classId, label: CLASS_META[classId].label, sum, count, avg };
  });

  classResults.sort((a, b) => {
    if (b.avg !== a.avg) return b.avg - a.avg;
    if (b.sum !== a.sum) return b.sum - a.sum;
    return a.classId - b.classId;
  });

  return {
    classResults,
    winner: classResults[0],
    answers,
  };
}
