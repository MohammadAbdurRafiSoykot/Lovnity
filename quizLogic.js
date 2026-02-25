// quizLogic.js
// Pure logic only (no DOM). Safe to unit-test.

(function (global) {
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function avg(nums) {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function evaluateAssessment(answers) {
    const scoreParts = [];

    scoreParts.push(answers.q1_gender ? 1 : 0);
    scoreParts.push(answers.q2_age ? 1 : 0);
    scoreParts.push(answers.q3_live === "Yes" ? 1 : 0);
    scoreParts.push(answers.q4_type === "Closed" ? 1 : 0);

    const togetherGood = ["3–5 years", "6–10 years", "11–20 years", "21–30 years", "over 30 years"].includes(
      answers.q5_together
    );
    scoreParts.push(togetherGood ? 1 : 0);

    const diffGood = ["less than 6 months", "6–12 months"].includes(answers.q6_difficulties);
    scoreParts.push(diffGood ? 1 : 0);

    const q7 = answers.q7 || {};
    const q7Vals = [
      q7.communication,
      q7.everyday,
      q7.trust,
      q7.differences,
      q7.conflicts,
      q7.handling,
      q7.emotional,
      q7.physical,
      q7.respect,
    ]
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v >= 1 && v <= 7);

    const q7Avg = avg(q7Vals);
    scoreParts.push(q7Vals.length === 9 && q7Avg <= 3.5 ? 1 : 0);

    scoreParts.push(answers.q8_divorce_considered === "No" ? 1 : 0);
    scoreParts.push(answers.q9_divorce_talked === "No" ? 1 : 0);
    scoreParts.push(answers.q10_committed === "Yes" ? 1 : 0);

    const score = clamp(scoreParts.reduce((a, b) => a + b, 0), 0, 10);

    // ---------------- Recommendations (pick top 2) ----------------
    const weights = [];
    function addRec(key, val, text) {
      if (!Number.isFinite(val)) return;
      weights.push({ key, weight: val, text });
    }

    addRec("communication", Number(q7.communication), "Improve communication 🗣️💞 (daily check-ins + “I” statements)");
    addRec("trust", Number(q7.trust), "Rebuild trust 🤝🔒 (clear agreements + consistency)");
    addRec("conflicts", Number(q7.conflicts), "Handle conflicts better 🧯🧩 (pause, repair, resolve)");
    addRec("emotional", Number(q7.emotional), "Reconnect emotionally 🫶✨ (share feelings, not only facts)");
    addRec("physical", Number(q7.physical), "Strengthen physical intimacy 💋🫂 (talk needs + plan affection)");
    addRec("respect", Number(q7.respect), "Boost mutual respect 🙏🌱 (reduce criticism, assume good intent)");

    if (answers.q8_divorce_considered === "Yes" || answers.q9_divorce_talked === "Yes") {
      weights.push({
        key: "therapy",
        weight: 10,
        text: "Consider guided support 🧑‍⚕️🧠 (couples therapy can help fast)",
      });
    }
    if (answers.q10_committed === "No") {
      weights.push({
        key: "commitment",
        weight: 9,
        text: "Clarify commitment & goals 🎯❤️ (what are you willing to work on?)",
      });
    }

    weights.sort((a, b) => b.weight - a.weight);

    const recs = [];
    const used = new Set();

    for (const w of weights) {
      if (recs.length >= 2) break;
      if (used.has(w.key)) continue;

      const isQ7Dim = ["communication", "trust", "conflicts", "emotional", "physical", "respect"].includes(w.key);
      if (isQ7Dim && w.weight < 5) continue;

      recs.push(w.text);
      used.add(w.key);
    }

    // Ensure at least 2 always
    const fallback = [
      "Create a weekly relationship check-in 🗓️🫶 (30 minutes, phones away)",
      "Use appreciation daily 🙌💗 (one specific compliment each day)",
    ];
    for (const f of fallback) {
      if (recs.length >= 2) break;
      if (!recs.includes(f)) recs.push(f);
    }

    return {
      score,
      q7Average: Number.isFinite(q7Avg) ? Number(q7Avg.toFixed(2)) : null,
      recommendations: recs.slice(0, 2), // ✅ only 2
    };
  }

  global.LovnityQuizLogic = { evaluateAssessment };
})(window);
