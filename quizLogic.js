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

  // answers object shape:
  // {
  //   q1_gender, q2_age, q3_live, q4_type, q5_together, q6_difficulties,
  //   q7: { communication, everyday, trust, differences, conflicts, handling, emotional, physical, respect },
  //   q8_divorce_considered, q9_divorce_talked, q10_committed
  // }
  function evaluateAssessment(answers) {
    const scoreParts = [];

    // Q1: answered => 1
    scoreParts.push(answers.q1_gender ? 1 : 0);

    // Q2: answered => 1
    scoreParts.push(answers.q2_age ? 1 : 0);

    // Q3: live together => 1 if Yes
    scoreParts.push(answers.q3_live === "Yes" ? 1 : 0);

    // Q4: relationship type => 1 if Closed
    scoreParts.push(answers.q4_type === "Closed" ? 1 : 0);

    // Q5: together => 1 if >= 3 years
    const togetherGood = ["3–5 years", "6–10 years", "11–20 years", "21–30 years", "over 30 years"].includes(
      answers.q5_together
    );
    scoreParts.push(togetherGood ? 1 : 0);

    // Q6: difficulties duration => 1 if < 1 year
    const diffGood = ["less than 6 months", "6–12 months"].includes(answers.q6_difficulties);
    scoreParts.push(diffGood ? 1 : 0);

    // Q7: relationship aspects => 1 if average problems is low (<= 3.5)
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

    // Q8: considered divorce => 1 if No
    scoreParts.push(answers.q8_divorce_considered === "No" ? 1 : 0);

    // Q9: talked about divorce => 1 if No
    scoreParts.push(answers.q9_divorce_talked === "No" ? 1 : 0);

    // Q10: committed => 1 if Yes
    scoreParts.push(answers.q10_committed === "Yes" ? 1 : 0);

    const score = clamp(scoreParts.reduce((a, b) => a + b, 0), 0, 10);

    // ---------------- Recommendations (pick top 3) ----------------
    // Higher number => more problems => higher priority.
    const weights = [];
    function addRec(key, val, text) {
      if (!Number.isFinite(val)) return;
      weights.push({ key, weight: val, text });
    }

    addRec("communication", Number(q7.communication), "Improve communication 🗣️💞 (use “I” statements + daily check-ins)");
    addRec("trust", Number(q7.trust), "Rebuild trust 🤝🔒 (clear agreements + consistency over time)");
    addRec("conflicts", Number(q7.conflicts), "Handle conflicts better 🧯🧩 (slow down, take breaks, repair after)");
    addRec("emotional", Number(q7.emotional), "Reconnect emotionally 🫶✨ (share feelings, not only facts)");
    addRec("physical", Number(q7.physical), "Strengthen physical intimacy 💋🫂 (talk needs + plan affection time)");
    addRec("respect", Number(q7.respect), "Strengthen mutual respect 🙏🌱 (no contempt, assume good intent)");

    // Big flags
    if (answers.q8_divorce_considered === "Yes" || answers.q9_divorce_talked === "Yes") {
      weights.push({
        key: "therapy",
        weight: 10,
        text: "Consider guided support 🧑‍⚕️🧠 (couples therapy / counseling can help fast)",
      });
    }
    if (answers.q10_committed === "No") {
      weights.push({
        key: "commitment",
        weight: 9,
        text: "Clarify commitment & goals 🎯❤️ (what are you both willing to work on?)",
      });
    }

    // Sort by highest problem/priority
    weights.sort((a, b) => b.weight - a.weight);

    // Take top unique 3, but only if “problem-ish”
    const recs = [];
    const used = new Set();
    for (const w of weights) {
      if (recs.length >= 3) break;
      if (used.has(w.key)) continue;

      // If it’s a Q7 dimension, require >=5 to be “major-ish” before recommending.
      const isQ7Dim = ["communication", "trust", "conflicts", "emotional", "physical", "respect"].includes(w.key);
      if (isQ7Dim && w.weight < 5) continue;

      recs.push(w.text);
      used.add(w.key);
    }

    // Ensure at least 3 suggestions always
    const fallback = [
      "Create a weekly relationship check-in 🗓️🫶 (30 minutes, phones away)",
      "Agree on 1 small habit to improve this week ✅🌱 (keep it realistic)",
      "Use appreciation daily 🙌💗 (say one specific thing you value each day)",
    ];
    for (const f of fallback) {
      if (recs.length >= 3) break;
      if (!recs.includes(f)) recs.push(f);
    }

    return {
      score,
      scoreParts, // optional for debugging
      q7Average: Number.isFinite(q7Avg) ? Number(q7Avg.toFixed(2)) : null,
      recommendations: recs.slice(0, 3),
    };
  }

  global.LovnityQuizLogic = { evaluateAssessment };
})(window);