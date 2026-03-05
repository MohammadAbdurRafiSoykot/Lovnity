document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  // -----------------------------
  // 1) INITIALIZE SUPABASE
  // -----------------------------
  const supabaseUrl = "https://nytlbtwhmrvpzxqzusxg.supabase.co"; // <-- CHANGE THIS if needed
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dGxidHdobXJ2cHp4cXp1c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2OTQsImV4cCI6MjA4NjgxNTY5NH0.mIx0MFqIHzL_zgpgLaDyImWgAAMoxRni2Nk-9iPYYzs"; // <-- CHANGE THIS if needed
  const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  // -----------------------------
  // 2) QUIZ CONFIG (PO REQUIREMENT)
  // -----------------------------
  // Classes:
  // 1 - Communication
  // 2 - Trust and Betrayal
  // 3 - Sex and intimacy
  const CLASS_META = {
    1: { label: "Communication" },
    2: { label: "Trust and Betrayal" },
    3: { label: "Sex and intimacy" },
  };

  // Topics -> class mapping as provided
  const QUIZ_ITEMS = [
    { id: "communication", label: "Communication", classId: 1 },
    { id: "everyday", label: "Everyday (household chores, responsibilities, schedules)", classId: 1 },
    { id: "trust", label: "Trust", classId: 2 },
    { id: "difference", label: "Difference", classId: 2 },
    { id: "conflicts", label: "Conflicts and problems Handling", classId: 1 },
    { id: "emotional_intimacy", label: "Emotional Intimacy", classId: 3 },
    { id: "physical_intimacy", label: "Physical Intimacy and Sexuality", classId: 3 },
    { id: "respect", label: "Respecting each other", classId: 1 },
  ];

  // Slider scale (you can tweak, but this is a clean “scale” UX)
  const SLIDER_MIN = 1;
  const SLIDER_MAX = 10;
  const SLIDER_STEP = 1;
  const SLIDER_DEFAULT = 5;

  // -----------------------------
  // 3) UI REFS
  // -----------------------------
  const UI = {
    panelLogin: $("#panelLogin"),
    panelRegister: $("#panelRegister"),
    panelWelcome: $("#panelWelcome"),
    panelQuiz: $("#panelQuiz"),
    panelResults: $("#panelResults"),

    topSubtitle: $("#topSubtitle"),

    loginForm: $("#loginForm"),
    loginMsg: $("#loginMsg"),
    goToRegisterBtn: $("#goToRegisterBtn"),

    registerForm: $("#registerForm"),
    regMsg: $("#regMsg"),
    backToLoginBtn: $("#backToLoginBtn"),

    welcomeLine: $("#welcomeLine"),
    welcomeTitle: $("#welcomeTitle"),
    welcomeCompany: $("#welcomeCompany"),
    welcomeCompanyLine: $("#welcomeCompanyLine"),
    continueBtn: $("#continueBtn"),
    logoutBtn: $("#logoutBtn"),
    logoutBtn2: $("#logoutBtn2"),

    helpBtn: $("#helpBtn"),
    helpModal: $("#helpModal"),
    modalBackdrop: $("#modalBackdrop"),
    closeModal: $("#closeModal"),
    modalOk: $("#modalOk"),

    quizForm: $("#quizForm"),
    quizContainer: $("#quizContainer"),
    quizMsg: $("#quizMsg"),
    quizProgress: $("#quizProgress"),
    quizBackBtn: $("#quizBackBtn"),

    resultsGrid: $("#resultsGrid"),
    recommendChip: $("#recommendChip"),
    recommendBox: $("#recommendBox"),
    resultsBackBtn: $("#resultsBackBtn"),
    restartBtn: $("#restartBtn"),
  };

  // Logos live in frontend only. DB returns partner info; map partner name -> logo here.
  const PARTNER_ASSETS = {
    Terveystalo: { logo: `TERVEYSTALO` },
    "Mehiläinen": { logo: `MEHILÄINEN` },
    "Lovnity Partner": { logo: `LOVNITY` },
  };

  // -----------------------------
  // 4) AUTH FLOW
  // -----------------------------
  checkSession();

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchProfileAndShowWelcome(session.user);
    } else {
      showLogin();
    }
  }

  UI.goToRegisterBtn.addEventListener("click", showRegister);
  UI.backToLoginBtn.addEventListener("click", showLogin);

  // Restrict invite code to 6 digits
  const inviteEl = $("#inviteCodeInput");
  if (inviteEl) {
    inviteEl.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    });
  }

  UI.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.loginMsg, "");

    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    disableForm(UI.loginForm, "Logging in...");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      enableForm(UI.loginForm, "Log In");
      setMsg(UI.loginMsg, "Invalid email or password.", "error");
      shake(UI.panelLogin);
      return;
    }

    await fetchProfileAndShowWelcome(data.user);
  });

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

    // Pre-check code
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

    // Register (Trigger handles rest)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: surname,
          age,
          gender,
          business_code: inviteCode,
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

  async function fetchProfileAndShowWelcome(user) {
    if (!user) return;

    let lastName = "User";
    let partnerName = null;

    try {
      // Ideal: fetch from DB
      const { data: profile } = await supabase
        .from("users")
        .select("last_name, business_partners(name)")
        .eq("id", user.id)
        .single();

      if (profile) {
        lastName = profile.last_name || lastName;
        partnerName = profile.business_partners?.name;
      } else {
        // Fallback: auth metadata
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
      lastName,
      partner: attachPartnerAssets(partnerName),
    });
  }

  UI.continueBtn.addEventListener("click", () => {
    // Start quiz immediately after welcome
    showQuiz();
  });

  UI.logoutBtn.addEventListener("click", doLogout);
  UI.logoutBtn2.addEventListener("click", doLogout);

  async function doLogout() {
    await supabase.auth.signOut();
    UI.loginForm.reset();
    UI.registerForm.reset();
    setMsg(UI.loginMsg, "");
    setMsg(UI.regMsg, "");
    showLogin();
  }

  // -----------------------------
  // 5) MODAL
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
  // 6) QUIZ UI + LOGIC (SLIDERS)
  // -----------------------------
  let lastQuizAnswers = null;

  UI.quizBackBtn.addEventListener("click", () => {
    // Back goes to welcome panel (not logout)
    showWelcomeOnly();
  });

  UI.resultsBackBtn.addEventListener("click", () => {
    showQuiz();
    // restore sliders to last answers
    if (lastQuizAnswers) hydrateQuizAnswers(lastQuizAnswers);
  });

  UI.restartBtn.addEventListener("click", () => {
    lastQuizAnswers = null;
    showQuiz();
    resetQuizToDefaults();
  });

  UI.quizForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setMsg(UI.quizMsg, "");

    const answers = readQuizAnswers();
    lastQuizAnswers = answers;

    const result = scoreQuiz(answers);
    showResults(result);
  });

  function showQuiz() {
    hideAllPanels();
    UI.panelQuiz.classList.remove("hidden");
    UI.topSubtitle.textContent = "Quiz: slide to score each topic.";

    renderQuiz();
    resetQuizToDefaults();
  }

  function renderQuiz() {
    // Only render once per visit (but safe to re-render)
    UI.quizContainer.innerHTML = "";

    for (const item of QUIZ_ITEMS) {
      const row = document.createElement("div");
      row.className = "quizRow";
      row.dataset.itemId = item.id;

      row.innerHTML = `
        <div class="quizRow__top">
          <div class="quizRow__label">
            <div class="quizRow__title">${escapeHtml(item.label)}</div>
            <div class="quizRow__class">Class ${item.classId}: ${escapeHtml(CLASS_META[item.classId].label)}</div>
          </div>

          <div class="quizRow__value" id="val_${escapeHtml(item.id)}">${SLIDER_DEFAULT}</div>
        </div>

        <div class="sliderWrap">
          <span class="sliderHint">${SLIDER_MIN}</span>
          <input
            class="slider"
            type="range"
            min="${SLIDER_MIN}"
            max="${SLIDER_MAX}"
            step="${SLIDER_STEP}"
            value="${SLIDER_DEFAULT}"
            name="${escapeHtml(item.id)}"
            aria-label="${escapeHtml(item.label)}"
          />
          <span class="sliderHint">${SLIDER_MAX}</span>
        </div>
      `;

      UI.quizContainer.appendChild(row);

      const slider = row.querySelector("input.slider");
      slider.addEventListener("input", () => {
        const v = Number(slider.value);
        const valueEl = row.querySelector(`#val_${cssEscape(item.id)}`);
        if (valueEl) valueEl.textContent = String(v);
        updateProgress();
      });
    }

    updateProgress();
  }

  function resetQuizToDefaults() {
    const sliders = UI.quizContainer.querySelectorAll("input.slider");
    sliders.forEach((s) => (s.value = String(SLIDER_DEFAULT)));
    // update the numeric readouts
    for (const item of QUIZ_ITEMS) {
      const vEl = $(`#val_${cssEscape(item.id)}`);
      if (vEl) vEl.textContent = String(SLIDER_DEFAULT);
    }
    updateProgress();
  }

  function updateProgress() {
    // here “progress” is just count of filled (always filled), but keeps UX consistent
    UI.quizProgress.textContent = `${QUIZ_ITEMS.length} / ${QUIZ_ITEMS.length}`;
  }

  function readQuizAnswers() {
    const answers = {};
    for (const item of QUIZ_ITEMS) {
      const slider = UI.quizContainer.querySelector(`input.slider[name="${cssEscape(item.id)}"]`);
      answers[item.id] = slider ? Number(slider.value) : SLIDER_DEFAULT;
    }
    return answers;
  }

  function hydrateQuizAnswers(answers) {
    for (const item of QUIZ_ITEMS) {
      const v = Number(answers[item.id] ?? SLIDER_DEFAULT);
      const slider = UI.quizContainer.querySelector(`input.slider[name="${cssEscape(item.id)}"]`);
      if (slider) slider.value = String(v);
      const vEl = $(`#val_${cssEscape(item.id)}`);
      if (vEl) vEl.textContent = String(v);
    }
    updateProgress();
  }

  function scoreQuiz(answers) {
    // Aggregate per class
    const agg = {
      1: { sum: 0, count: 0 },
      2: { sum: 0, count: 0 },
      3: { sum: 0, count: 0 },
    };

    for (const item of QUIZ_ITEMS) {
      const v = Number(answers[item.id] ?? 0);
      agg[item.classId].sum += v;
      agg[item.classId].count += 1;
    }

    const classResults = Object.keys(agg).map((k) => {
      const classId = Number(k);
      const sum = agg[classId].sum;
      const count = agg[classId].count;
      const avg = count ? sum / count : 0;
      return {
        classId,
        label: CLASS_META[classId].label,
        sum,
        count,
        avg,
      };
    });

    // Highest average wins (tie-breaker: higher sum, then lower classId)
    classResults.sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.sum !== a.sum) return b.sum - a.sum;
      return a.classId - b.classId;
    });

    const winner = classResults[0];

    return {
      classResults,
      winner,
      answers,
    };
  }

  function showResults(result) {
    hideAllPanels();
    UI.panelResults.classList.remove("hidden");
    UI.topSubtitle.textContent = "Your quiz results.";

    // Cards for each class
    UI.resultsGrid.innerHTML = "";
    for (const r of result.classResults.slice().sort((a, b) => a.classId - b.classId)) {
      const card = document.createElement("div");
      card.className = "resultCard";

      card.innerHTML = `
        <div class="resultCard__title">Class ${r.classId}: ${escapeHtml(r.label)}</div>
        <div class="resultCard__meta">Sum: <strong>${r.sum}</strong> • Items: <strong>${r.count}</strong></div>
        <div class="resultCard__avg">Average: <strong>${format1(r.avg)}</strong></div>
      `;
      UI.resultsGrid.appendChild(card);
    }

    UI.recommendChip.textContent = `Recommended: ${result.winner.label}`;

    UI.recommendBox.innerHTML = `
      <div class="recommendTitle">Suggested bot class</div>
      <div class="recommendMain">${escapeHtml(result.winner.label)}</div>
      <div class="recommendSub">
        This recommendation is based on the <strong>highest average</strong> score across the 3 classes.
      </div>
    `;
  }

  // -----------------------------
  // 7) VIEW SWITCHING
  // -----------------------------
  function hideAllPanels() {
    UI.panelLogin.classList.add("hidden");
    UI.panelRegister.classList.add("hidden");
    UI.panelWelcome.classList.add("hidden");
    UI.panelQuiz.classList.add("hidden");
    UI.panelResults.classList.add("hidden");
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

  function showWelcomeOnly() {
    hideAllPanels();
    UI.panelWelcome.classList.remove("hidden");
    UI.topSubtitle.textContent = "You're all set.";
  }

  function showWelcome(profile) {
    hideAllPanels();
    UI.panelWelcome.classList.remove("hidden");

    const p = profile.partner || {};
    UI.topSubtitle.textContent = "You're all set.";
    UI.welcomeLine.textContent = "Authentication successful.";
    UI.welcomeTitle.textContent = `Welcome, ${escapeHtml(profile.lastName)}! 💗`;

    UI.welcomeCompany.textContent = p.name ? `Greetings from ${p.name}` : "Greetings from Partner";
    UI.welcomeCompanyLine.textContent = p.name ? `You are connected via ${p.name}.` : "";

    const logoEl = $("#welcomeLogo");
    if (logoEl) logoEl.textContent = p.logo || "LOVNITY";

    const heart = $("#welcomeHeart");
    if (heart && p.accent) heart.style.setProperty("--heart-color", p.accent);
  }

  // -----------------------------
  // 8) HELPERS
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
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return map[c] || c;
    });
  }

  // For querySelector with ids/names that may include underscores etc.
  function cssEscape(s) {
    return String(s).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|/@])/g, "\\$1");
  }

  function attachPartnerAssets(partnerName) {
    const assets = partnerName && PARTNER_ASSETS[partnerName] ? PARTNER_ASSETS[partnerName] : {};
    return {
      name: partnerName || "Partner",
      accent: assets.accent || "",
      logo: assets.logo || "",
    };
  }

  function format1(n) {
    return (Math.round(n * 10) / 10).toFixed(1);
  }
});
