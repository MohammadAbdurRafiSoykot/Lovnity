import {
  CLASS_META,
  QUIZ_ITEMS,
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_STEP,
  SLIDER_DEFAULT,
  scoreQuiz,
} from "./quizlogic.js";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  // -----------------------------
  // 1) INITIALIZE SUPABASE
  // -----------------------------
  // NOTE: keep your existing project URL + anon key
  const supabaseUrl = "https://nytlbtwhmrvpzxqzusxg.supabase.co"; // <-- change if needed
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dGxidHdobXJ2cHp4cXp1c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2OTQsImV4cCI6MjA4NjgxNTY5NH0.mIx0MFqIHzL_zgpgLaDyImWgAAMoxRni2Nk-9iPYYzs"; // <-- change if needed
  const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  // -----------------------------
  // 2) UI REFS
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

  // Optional: map partner name -> simple logo text (front-end only)
  const PARTNER_ASSETS = {
    Terveystalo: { logo: "TERVEYSTALO" },
    "Mehiläinen": { logo: "MEHILÄINEN" },
    "Lovnity Partner": { logo: "LOVNITY" },
  };

  // -----------------------------
  // 3) AUTH FLOW
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

  // Invite code: numeric 6 digits
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

    // Validate invite code (assumes your DB table partner_invites exists)
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

    // Register (your existing trigger handles linking business partner etc.)
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
    await sleep(400);
    await fetchProfileAndShowWelcome(data.user);
  });

  async function fetchProfileAndShowWelcome(user) {
    if (!user) return;

    let lastName = "User";
    let partnerName = null;

    try {
      const { data: profile } = await supabase
        .from("users")
        .select("last_name, business_partners(name)")
        .eq("id", user.id)
        .single();

      if (profile) {
        lastName = profile.last_name || lastName;
        partnerName = profile.business_partners?.name;
      } else {
        // fallback
        const meta = user.user_metadata || {};
        lastName = meta.last_name || meta.first_name || "User";

        if (meta.business_code) {
          const { data: invite } = await supabase
            .from("partner_invites")
            .select("business_partners(name)")
            .eq("code", meta.business_code)
            .single();

          if (invite?.business_partners?.name) {
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

  UI.continueBtn.addEventListener("click", () => showQuiz());
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
  // 4) HELP MODAL
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
  // 5) QUIZ UI + STATE
  // -----------------------------
  let lastQuizAnswers = null;

  UI.quizBackBtn.addEventListener("click", () => {
    showWelcomeOnly();
  });

  UI.resultsBackBtn.addEventListener("click", () => {
    showQuiz();
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
    UI.quizContainer.innerHTML = "";

    for (const item of QUIZ_ITEMS) {
      const row = document.createElement("div");
      row.className = "quizRow";
      row.dataset.itemId = item.id;

      const safeLabel = escapeHtml(item.label);
      const classLabel = escapeHtml(CLASS_META[item.classId].label);

      row.innerHTML = `
        <div class="quizRow__top">
          <div class="quizRow__label">
            <div class="quizRow__title">${safeLabel}</div>
            <div class="quizRow__class">Class ${item.classId}: ${classLabel}</div>
          </div>

          <div class="quizRow__value">${SLIDER_DEFAULT}</div>
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
            aria-label="${safeLabel}"
          />
          <span class="sliderHint">${SLIDER_MAX}</span>
        </div>
      `;

      UI.quizContainer.appendChild(row);

      const slider = row.querySelector("input.slider");
      const valueEl = row.querySelector(".quizRow__value");

      slider.addEventListener("input", () => {
        valueEl.textContent = String(slider.value);
        updateProgress();
      });
    }

    updateProgress();
  }

  function resetQuizToDefaults() {
    const sliders = UI.quizContainer.querySelectorAll("input.slider");
    sliders.forEach((s) => (s.value = String(SLIDER_DEFAULT)));

    // Update displayed values
    const rows = UI.quizContainer.querySelectorAll(".quizRow");
    rows.forEach((row) => {
      const vEl = row.querySelector(".quizRow__value");
      if (vEl) vEl.textContent = String(SLIDER_DEFAULT);
    });

    updateProgress();
  }

  function updateProgress() {
    UI.quizProgress.textContent = `${QUIZ_ITEMS.length} / ${QUIZ_ITEMS.length}`;
  }

  function readQuizAnswers() {
    const answers = {};
    const rows = UI.quizContainer.querySelectorAll(".quizRow");

    rows.forEach((row) => {
      const id = row.dataset.itemId;
      const slider = row.querySelector("input.slider");
      answers[id] = slider ? Number(slider.value) : SLIDER_DEFAULT;
    });

    return answers;
  }

  function hydrateQuizAnswers(answers) {
    const rows = UI.quizContainer.querySelectorAll(".quizRow");

    rows.forEach((row) => {
      const id = row.dataset.itemId;
      const slider = row.querySelector("input.slider");
      const vEl = row.querySelector(".quizRow__value");

      const v = Number(answers?.[id] ?? SLIDER_DEFAULT);

      if (slider) slider.value = String(v);
      if (vEl) vEl.textContent = String(v);
    });

    updateProgress();
  }

  function showResults(result) {
    hideAllPanels();
    UI.panelResults.classList.remove("hidden");
    UI.topSubtitle.textContent = "Your quiz results.";

    // Display all classes in classId order
    const ordered = result.classResults.slice().sort((a, b) => a.classId - b.classId);

    UI.resultsGrid.innerHTML = "";
    for (const r of ordered) {
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
        Recommendation is based on the <strong>highest average</strong> across the 3 classes.
      </div>
    `;
  }

  // -----------------------------
  // 6) VIEW SWITCHING
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
  }

  // -----------------------------
  // 7) HELPERS
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
    if (!el) return;
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

  function attachPartnerAssets(partnerName) {
    const assets = partnerName && PARTNER_ASSETS[partnerName] ? PARTNER_ASSETS[partnerName] : {};
    return {
      name: partnerName || "Partner",
      logo: assets.logo || "",
    };
  }

  function format1(n) {
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }
});
