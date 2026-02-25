document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  // -----------------------------
  // 1. INITIALIZE SUPABASE
  // -----------------------------
  const supabaseUrl = "https://nytlbtwhmrvpzxqzusxg.supabase.co";
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dGxidHdobXJ2cHp4cXp1c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2OTQsImV4cCI6MjA4NjgxNTY5NH0.mIx0MFqIHzL_zgpgLaDyImWgAAMoxRni2Nk-9iPYYzs";
  const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  // -----------------------------
  // 2. UI ELEMENTS
  // -----------------------------
  const UI = {
    // existing panels
    panelLogin: $("#panelLogin"),
    panelRegister: $("#panelRegister"),
    panelWelcome: $("#panelWelcome"),
    topSubtitle: $("#topSubtitle"),

    // auth elements
    loginForm: $("#loginForm"),
    loginMsg: $("#loginMsg"),
    goToRegisterBtn: $("#goToRegisterBtn"),

    registerForm: $("#registerForm"),
    regMsg: $("#regMsg"),
    backToLoginBtn: $("#backToLoginBtn"),

    // welcome
    welcomeLine: $("#welcomeLine"),
    welcomeTitle: $("#welcomeTitle"),
    welcomeCompany: $("#welcomeCompany"),
    continueBtn: $("#continueBtn"),
    logoutBtn: $("#logoutBtn"),

    // help modal
    helpBtn: $("#helpBtn"),
    helpModal: $("#helpModal"),
    modalBackdrop: $("#modalBackdrop"),
    closeModal: $("#closeModal"),
    modalOk: $("#modalOk"),

    // NEW: assessment panels
    panelAssessmentIntro: $("#panelAssessmentIntro"),
    panelAssessmentQuiz: $("#panelAssessmentQuiz"),
    panelAssessmentResult: $("#panelAssessmentResult"),

    takeQuizBtn: $("#takeQuizBtn"),
    skipQuizBtn: $("#skipQuizBtn"),

    assessmentForm: $("#assessmentForm"),
    assessmentMsg: $("#assessmentMsg"),
    assessmentCancelBtn: $("#assessmentCancelBtn"),

    assessmentScoreLine: $("#assessmentScoreLine"),
    assessmentExtraLine: $("#assessmentExtraLine"),
    assessmentRecs: $("#assessmentRecs"),

    assessmentDoneBtn: $("#assessmentDoneBtn"),
    assessmentRetakeBtn: $("#assessmentRetakeBtn"),
  };

  // Logos live in frontend only. DB returns partner info; map partner name -> logo here.
  const PARTNER_ASSETS = {
    Terveystalo: { logo: ` TERVEYSTALO ` },
    "Mehiläinen": { logo: ` MEHILÄINEN ` },
    "Lovnity Partner": { logo: ` LOVNITY ` },
  };

  // keep current user in memory (useful for saving assessment)
  let CURRENT_USER = null;

  // -----------------------------
  // 3. SESSION CHECK
  // -----------------------------
  checkSession();

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      await fetchProfileAndShowWelcome(session.user);
    } else {
      showLogin();
    }
  }

  // -----------------------------
  // 4. NAVIGATION
  // -----------------------------
  UI.goToRegisterBtn.addEventListener("click", showRegister);
  UI.backToLoginBtn.addEventListener("click", showLogin);

  // Restrict Invite Code Input to Numbers
  $("#inviteCodeInput").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  });

  // -----------------------------
  // 5. LOGIN
  // -----------------------------
  UI.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.loginMsg, "");

    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    disableForm(UI.loginForm, "Logging in...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      enableForm(UI.loginForm, "Log In");
      setMsg(UI.loginMsg, "Invalid email or password.", "error");
      shake(UI.panelLogin);
      return;
    }

    await fetchProfileAndShowWelcome(data.user);
  });

  // -----------------------------
  // 6. REGISTRATION
  // -----------------------------
  UI.registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.regMsg, "");

    const firstName = $("#firstNameInput").value.trim();
    const surname = $("#surnameInput").value.trim();
    const gender = $("#genderInput").value.trim();
    const age = Number($("#ageInput").value.trim());
    const email = $("#regEmail").value.trim();
    const password = $("#regPassword").value;
    const inviteCode = $("#inviteCodeInput").value.trim();

    if (inviteCode.length !== 6) {
      setMsg(UI.regMsg, "Invite code must be exactly 6 digits.", "error");
      return;
    }

    disableForm(UI.registerForm, "Creating account...");

    // 1) Pre-check the code so we can fail early on the frontend if it's wrong
    const { data: codeCheck, error: codeErr } = await supabase
      .from("partner_invites")
      .select("code")
      .eq("code", inviteCode)
      .eq("is_used", false)
      .single();

    if (codeErr || !codeCheck) {
      enableForm(UI.registerForm, "Sign Up");
      setMsg(UI.regMsg, "Invalid or already used invite code.", "error");
      shake(UI.panelRegister);
      return;
    }

    // 2) Register the user (Trigger handles the rest)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: surname,
          age: age,
          gender: gender,
          business_code: inviteCode, // Matches SQL trigger logic
        },
      },
    });

    if (error) {
      enableForm(UI.registerForm, "Sign Up");
      setMsg(UI.regMsg, error.message, "error");
      return;
    }

    setMsg(UI.regMsg, "Success! Logging you in...", "success");
    await sleep(500);
    await fetchProfileAndShowWelcome(data.user);
  });

  // -----------------------------
  // 7. WELCOME (profile fetch)
  // -----------------------------
  async function fetchProfileAndShowWelcome(user) {
    if (!user) return;

    CURRENT_USER = user;

    let lastName = "User";
    let partnerName = null;

    try {
      // 1) Try to fetch from the database (Ideal Scenario)
      const { data: profile } = await supabase
        .from("users")
        .select("last_name, business_partners(name)")
        .eq("id", user.id)
        .single();

      if (profile) {
        lastName = profile.last_name || lastName;
        partnerName = profile.business_partners?.name;
      } else {
        // 2) FALLBACK: If profile row is missing, check Auth Metadata directly!
        const meta = user.user_metadata || {};
        lastName = meta.last_name || meta.first_name || "User";

        if (meta.business_code) {
          const { data: invite } = await supabase
            .from("partner_invites")
            .select("business_partners(name)")
            .eq("code", meta.business_code)
            .single();

          if (invite && invite.business_partners) {
            partnerName = invite.business_partners.name;
          }
        }
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }

    showWelcome({
      lastName: lastName,
      partner: attachPartnerAssets(partnerName),
    });
  }

  // Welcome -> Assessment Intro (NEW)
  UI.continueBtn.addEventListener("click", () => {
    showAssessmentIntro();
  });

  UI.logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    CURRENT_USER = null;
    UI.loginForm.reset();
    UI.registerForm.reset();
    showLogin();
  });

  // -----------------------------
  // 8. ASSESSMENT FLOW (NEW)
  // -----------------------------
  UI.takeQuizBtn.addEventListener("click", showAssessmentQuiz);

  UI.skipQuizBtn.addEventListener("click", () => {
    // keep your existing placeholder behavior
    alert("Next: route to your main app page.");
  });

  UI.assessmentCancelBtn.addEventListener("click", () => {
    showAssessmentIntro();
  });

  UI.assessmentRetakeBtn.addEventListener("click", () => {
    UI.assessmentForm.reset();
    setMsg(UI.assessmentMsg, "");
    showAssessmentQuiz();
  });

  UI.assessmentDoneBtn.addEventListener("click", () => {
    // keep your existing placeholder behavior
    alert("Next: route to your main app page.");
  });

  UI.assessmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.assessmentMsg, "");

    const answers = readAssessmentAnswers();
    if (!answers) return;

    const evaluator = window.LovnityQuizLogic?.evaluateAssessment;
    if (typeof evaluator !== "function") {
      setMsg(
        UI.assessmentMsg,
        "Quiz logic not loaded. Make sure quizLogic.js is included before app.js.",
        "error"
      );
      return;
    }

    const result = evaluator(answers);

    // Save ONLY {user_id, score, recommendations} in backend
    // NOTE: create this table in Supabase (recommended name): relationship_assessments
    // Columns: id uuid pk, user_id uuid, score int, recommendations jsonb, created_at timestamptz
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw userErr || new Error("Not logged in.");

      const payload = {
        user_id: user.id,
        score: result.score,
        recommendations: result.recommendations, // json/jsonb
      };

      const { error: insErr } = await supabase
        .from("relationship_assessments")
        .insert(payload);

      if (insErr) throw insErr;
    } catch (err) {
      console.error(err);
      setMsg(
        UI.assessmentMsg,
        "Could not save result to backend (table/policy). Showing your result anyway.",
        "error"
      );
      // continue to show result even if save fails
    }

    renderAssessmentResult(result);
    showAssessmentResult();
  });

  function readAssessmentAnswers() {
    const get = (id) => $(id)?.value?.trim();

    const q7 = {
      communication: Number(get("#q7_communication")),
      everyday: Number(get("#q7_everyday")),
      trust: Number(get("#q7_trust")),
      differences: Number(get("#q7_differences")),
      conflicts: Number(get("#q7_conflicts")),
      handling: Number(get("#q7_handling")),
      emotional: Number(get("#q7_emotional")),
      physical: Number(get("#q7_physical")),
      respect: Number(get("#q7_respect")),
    };

    // validate Q7 1..7
    for (const [k, v] of Object.entries(q7)) {
      if (!Number.isFinite(v) || v < 1 || v > 7) {
        setMsg(UI.assessmentMsg, `Question 7: "${k}" must be a number 1–7.`, "error");
        return null;
      }
    }

    const answers = {
      q1_gender: get("#q1_gender"),
      q2_age: get("#q2_age"),
      q3_live: get("#q3_live"),
      q4_type: get("#q4_type"),
      q5_together: get("#q5_together"),
      q6_difficulties: get("#q6_difficulties"),
      q7,
      q8_divorce_considered: get("#q8_divorce_considered"),
      q9_divorce_talked: get("#q9_divorce_talked"),
      q10_committed: get("#q10_committed"),
    };

    for (const [k, v] of Object.entries(answers)) {
      if (k === "q7") continue;
      if (!v) {
        setMsg(UI.assessmentMsg, "Please answer all questions before submitting.", "error");
        return null;
      }
    }

    return answers;
  }

  function renderAssessmentResult(result) {
    UI.assessmentScoreLine.textContent = `Score: ${result.score} / 10 🧾`;
    UI.assessmentExtraLine.textContent =
      result.q7Average != null
        ? `Your “relationship aspects” average: ${result.q7Average} (1–7 scale)`
        : "";

    UI.assessmentRecs.innerHTML = "";
    (result.recommendations || []).forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      UI.assessmentRecs.appendChild(li);
    });
  }

  // -----------------------------
  // 9. MODALS
  // -----------------------------
  UI.helpBtn.addEventListener("click", () => {
    UI.modalBackdrop.classList.remove("hidden");
    UI.helpModal.classList.remove("hidden");
  });

  const closeHelpModal = () => {
    UI.modalBackdrop.classList.add("hidden");
    UI.helpModal.classList.add("hidden");
  };

  UI.closeModal.addEventListener("click", closeHelpModal);
  UI.modalOk.addEventListener("click", closeHelpModal);
  UI.modalBackdrop.addEventListener("click", closeHelpModal);

  // -----------------------------
  // 10. VIEWS
  // -----------------------------
  function hideAllPanels() {
    UI.panelLogin.classList.add("hidden");
    UI.panelRegister.classList.add("hidden");
    UI.panelWelcome.classList.add("hidden");

    // new panels
    UI.panelAssessmentIntro.classList.add("hidden");
    UI.panelAssessmentQuiz.classList.add("hidden");
    UI.panelAssessmentResult.classList.add("hidden");
  }

  function showLogin() {
    hideAllPanels();
    UI.panelLogin.classList.remove("hidden");
    UI.topSubtitle.textContent = "Sign in to your account.";
    setMsg(UI.loginMsg, "");
  }

  function showRegister() {
    hideAllPanels();
    UI.panelRegister.classList.remove("hidden");
    UI.topSubtitle.textContent = "Create your new account.";
    setMsg(UI.regMsg, "");
  }

  function showWelcome(profile) {
    hideAllPanels();
    UI.panelWelcome.classList.remove("hidden");

    const p = profile.partner || {};
    UI.topSubtitle.textContent = "You're all set.";
    UI.welcomeLine.textContent = "Authentication successful.";
    UI.welcomeTitle.textContent = `Welcome, ${escapeHtml(profile.lastName)}! 💗`;
    UI.welcomeCompany.textContent = p.name ? `Greetings from ${p.name}` : "Greetings from Partner";
    UI.welcomeCompany.style.color = p.accent || "";

    const logoEl = $("#welcomeLogo");
    if (logoEl) logoEl.innerHTML = p.logo || "";

    const heart = $("#welcomeHeart");
    if (heart && p.accent) heart.style.setProperty("--heart-color", p.accent);
  }

  function showAssessmentIntro() {
    hideAllPanels();
    UI.panelAssessmentIntro.classList.remove("hidden");
    UI.topSubtitle.textContent = "Before you continue…";
    setMsg(UI.assessmentMsg, "");
  }

  function showAssessmentQuiz() {
    hideAllPanels();
    UI.panelAssessmentQuiz.classList.remove("hidden");
    UI.topSubtitle.textContent = "Relationship assessment";
    setMsg(UI.assessmentMsg, "");
  }

  function showAssessmentResult() {
    hideAllPanels();
    UI.panelAssessmentResult.classList.remove("hidden");
    UI.topSubtitle.textContent = "Your assessment result";
  }

  // -----------------------------
  // 11. HELPERS
  // -----------------------------
  function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("msg--error", "msg--success");
    if (type === "error") el.classList.add("msg--error");
    if (type === "success") el.classList.add("msg--success");
  }

  function disableForm(form, text) {
    const btn = form.querySelector("button[type='submit']");
    if (btn) {
      btn.disabled = true;
      btn.textContent = text;
    }
  }

  function enableForm(form, text) {
    const btn = form.querySelector("button[type='submit']");
    if (btn) {
      btn.disabled = false;
      btn.textContent = text;
    }
  }

  function shake(el) {
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "ease-out" }
    );
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      return (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c] || c
      );
    });
  }

  function attachPartnerAssets(partnerName) {
    const assets = partnerName && PARTNER_ASSETS[partnerName] ? PARTNER_ASSETS[partnerName] : {};
    return {
      name: partnerName || "Partner",
      accent: assets.accent || "",
      logo: assets.logo || "",
    };
  }
});