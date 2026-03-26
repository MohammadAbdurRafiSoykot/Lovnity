import {
  CLASS_META,
  QUIZ_ITEMS,
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_STEP,
  SLIDER_DEFAULT,
  scoreQuiz,
} from "./quizLogic.js";

import { initChatbot } from "./chatbot.js";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  // -----------------------------
  // 1) INITIALIZE SUPABASE
  // -----------------------------
  const supabaseUrl     = "https://nytlbtwhmrvpzxqzusxg.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dGxidHdobXJ2cHp4cXp1c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2OTQsImV4cCI6MjA4NjgxNTY5NH0.mIx0MFqIHzL_zgpgLaDyImWgAAMoxRni2Nk-9iPYYzs";
  const supabase        = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  // -----------------------------
  // 2) UI REFS
  // -----------------------------
  const UI = {
    panelLogin:    $("#panelLogin"),
    panelRegister: $("#panelRegister"),
    panelWelcome:  $("#panelWelcome"),
    panelQuiz:     $("#panelQuiz"),
    panelResults:  $("#panelResults"),
    panelChat:     $("#panelChat"),

    topSubtitle: $("#topSubtitle"),

    loginForm:       $("#loginForm"),
    loginMsg:        $("#loginMsg"),
    goToRegisterBtn: $("#goToRegisterBtn"),

    registerForm:    $("#registerForm"),
    regMsg:          $("#regMsg"),
    backToLoginBtn:  $("#backToLoginBtn"),

    welcomeLine:        $("#welcomeLine"),
    welcomeTitle:       $("#welcomeTitle"),
    welcomeCompany:     $("#welcomeCompany"),
    welcomeCompanyLine: $("#welcomeCompanyLine"),
    continueBtn:        $("#continueBtn"),
    logoutBtn:          $("#logoutBtn"),
    logoutBtn2:         $("#logoutBtn2"),

    helpBtn:       $("#helpBtn"),
    helpModal:     $("#helpModal"),
    modalBackdrop: $("#modalBackdrop"),
    closeModal:    $("#closeModal"),
    modalOk:       $("#modalOk"),

    profileBtn:          $("#profileBtn"),
    profileModal:        $("#profileModal"),
    closeProfileModal:   $("#closeProfileModal"),
    profileModalOk:      $("#profileModalOk"),

    quizForm:      $("#quizForm"),
    quizContainer: $("#quizContainer"),
    quizMsg:       $("#quizMsg"),
    quizProgress:  $("#quizProgress"),
    quizBackBtn:   $("#quizBackBtn"),

    resultsGrid:    $("#resultsGrid"),
    recommendChip:  $("#recommendChip"),
    recommendBox:   $("#recommendBox"),
    resultsBackBtn: $("#resultsBackBtn"),
    restartBtn:     $("#restartBtn"),
    chatWithAIBtn:  $("#chatWithAIBtn"),
  };

  // Partner invite elements — optional, won't throw if missing
  const invitePartnerInput = $("#invitePartnerInput");
  const invitePartnerBtn   = $("#invitePartnerBtn");
  const invitePartnerMsg   = $("#invitePartnerMsg");

  const PARTNER_ASSETS = {
    Terveystalo:      { logo: "TERVEYSTALO" },
    "Mehiläinen":     { logo: "MEHILÄINEN"  },
    "Lovnity Partner":{ logo: "LOVNITY"     },
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
  UI.backToLoginBtn.addEventListener("click",  showLogin);

  // Business invite code input — alphanumeric only (e.g. 253fe3)
  const inviteEl = $("#inviteCodeInput");
  if (inviteEl) {
    inviteEl.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    });
  }

  // Partner invite code input — alphanumeric only (e.g. 253fe3)
  if (invitePartnerInput) {
    invitePartnerInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    });
  }

  UI.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.loginMsg, "");
    const email    = $("#loginEmail").value.trim();
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
    const firstName  = $("#firstNameInput").value.trim();
    const surname    = $("#surnameInput").value.trim();
    const gender     = $("#genderInput").value.trim();
    const age        = Number($("#ageInput").value.trim());
    const email      = $("#regEmail").value.trim();
    const password   = $("#regPassword").value;
    const inviteCode = $("#inviteCodeInput").value.trim();

    if (inviteCode.length !== 6) {
      setMsg(UI.regMsg, "Invite code must be exactly 6 characters.", "error");
      return;
    }

    disableForm(UI.registerForm, "Creating account...");

    // Check if this is a partner join (code exists in users.couple_code)
    const { data: isPartnerCode } = await supabase
      .rpc("check_couple_code", { input_code: inviteCode.toLowerCase() });

    // If not a partner code, validate against business_invites (normal business signup)
    if (!isPartnerCode) {
      const { data: bizCheck, error: bizErr } = await supabase
        .rpc("check_business_code", { input_code: inviteCode.toLowerCase() });
      if (bizErr || !bizCheck) {
        enableForm(UI.registerForm, "Sign Up");
        setMsg(UI.regMsg, "Invalid or already used invite code.", "error");
        shake(UI.panelRegister);
        return;
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name:    firstName,
          last_name:     surname,
          age,
          gender,
          business_code: inviteCode.toLowerCase(),
          is_partner_join: isPartnerCode ? true : false,
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

  // ── Partner invite flow ────────────────────────────────────────
  // User enters a 6-digit partner invite code (sent by their partner)
  // → validates the code → pre-fills register form → user signs up
  if (invitePartnerBtn) {
    invitePartnerBtn.addEventListener("click", () => submitPartnerInvite());
  }
  if (invitePartnerInput) {
    invitePartnerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submitPartnerInvite(); }
    });
  }

  async function submitPartnerInvite() {
    if (!invitePartnerInput || !invitePartnerMsg) return;

    const code = invitePartnerInput.value.trim().toLowerCase();

    if (code.length !== 6) {
      setMsg(invitePartnerMsg, "Please enter a 6-character partner invite code.", "error");
      return;
    }

    if (invitePartnerBtn) {
      invitePartnerBtn.disabled    = true;
      invitePartnerBtn.textContent = "Checking…";
    }

    try {
      // Uses an RPC function that runs as SECURITY DEFINER (bypasses RLS)
      // Run this SQL once in Supabase SQL Editor:
      //
      //   create or replace function check_couple_code(input_code text)
      //   returns boolean
      //   language sql
      //   security definer
      //   as $$
      //     select exists (
      //       select 1 from users where couple_code = input_code
      //     );
      //   $$;
      //
      const { data: isValid, error: rpcErr } = await supabase
        .rpc("check_couple_code", { input_code: code });

      console.log("Partner code RPC result:", { isValid, rpcErr });

      if (invitePartnerBtn) {
        invitePartnerBtn.disabled    = false;
        invitePartnerBtn.textContent = "Join →";
      }

      if (rpcErr || !isValid) {
        setMsg(invitePartnerMsg, "Partner invite code not recognised. Please check the code.", "error");
        if (invitePartnerInput.closest) shake(invitePartnerInput.closest(".invitePartnerBox") || invitePartnerInput);
        return;
      }

      // Valid — switch to register panel with the code pre-filled
      setMsg(invitePartnerMsg, "Code accepted! Fill in your details below.", "success");
      await sleep(300);

      showRegister();

      // Pre-fill AND lock the business invite code field
      const inviteCodeField = $("#inviteCodeInput");
      if (inviteCodeField) {
        inviteCodeField.value    = code;
        inviteCodeField.readOnly = true;
      }

      setMsg(UI.regMsg, "💌 Joining your partner — your code has been filled in automatically.", "success");

    } catch (err) {
      console.error("submitPartnerInvite error:", err);
      if (invitePartnerBtn) {
        invitePartnerBtn.disabled    = false;
        invitePartnerBtn.textContent = "Join →";
      }
      setMsg(invitePartnerMsg, "Could not verify code right now — try again shortly.", "error");
    }
  }
  // ── End partner invite flow ────────────────────────────────────

  async function fetchProfileAndShowWelcome(user) {
    if (!user) return;
    let lastName    = "User";
    let partnerName = null;
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("last_name, business_partners(name)")
        .eq("id", user.id)
        .single();
      if (profile) {
        lastName    = profile.last_name || lastName;
        partnerName = profile.business_partners?.name;
      } else {
        const meta = user.user_metadata || {};
        lastName   = meta.last_name || meta.first_name || "User";
        if (meta.business_code) {
          const { data: invite } = await supabase
            .from("business_invites")
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
    showWelcome({ lastName, partner: attachPartnerAssets(partnerName) });
  }

  UI.continueBtn.addEventListener("click", () => showQuiz());
  UI.logoutBtn.addEventListener("click",   doLogout);
  UI.logoutBtn2.addEventListener("click",  doLogout);

  async function doLogout() {
    await supabase.auth.signOut();
    UI.loginForm.reset();
    UI.registerForm.reset();
    // Unlock the invite code field if it was locked
    const inviteCodeField = $("#inviteCodeInput");
    if (inviteCodeField) inviteCodeField.readOnly = false;
    setMsg(UI.loginMsg, "");
    setMsg(UI.regMsg,   "");
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

  UI.closeModal.addEventListener("click",    closeHelpModal);
  UI.modalOk.addEventListener("click",       closeHelpModal);
  UI.modalBackdrop.addEventListener("click", () => {
    closeHelpModal();
    closeProfileModalFn();
  });

  // ── Profile Info modal ──────────────────────────────────────
  const closeProfileModalFn = () => {
    UI.modalBackdrop.classList.add("hidden");
    UI.profileModal.classList.add("hidden");
  };

  if (UI.profileBtn) {
    UI.profileBtn.addEventListener("click", async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("users")
            .select("first_name, last_name, age, gender")
            .eq("id", user.id)
            .single();

          const meta      = user.user_metadata || {};
          const firstName = profile?.first_name || meta.first_name || "—";
          const lastName  = profile?.last_name  || meta.last_name  || "—";
          const age       = profile?.age        || meta.age        || "—";
          const gender    = profile?.gender     || meta.gender     || "—";

          $("#profileName").textContent   = `${firstName} ${lastName}`;
          $("#profileAge").textContent    = String(age);
          $("#profileGender").textContent = gender;
        }
      } catch (err) {
        console.error("Profile modal fetch error:", err);
      }
      UI.modalBackdrop.classList.remove("hidden");
      UI.profileModal.classList.remove("hidden");
    });
  }

  if (UI.closeProfileModal) UI.closeProfileModal.addEventListener("click", closeProfileModalFn);
  if (UI.profileModalOk)    UI.profileModalOk.addEventListener("click",    closeProfileModalFn);
  // ── End profile modal ───────────────────────────────────────

  // -----------------------------
  // 5) QUIZ UI + STATE
  // -----------------------------
  let lastQuizAnswers = null;
  let lastQuizResult  = null;
  let currentUserName = "Friend";
  let currentUserId   = null;

  UI.quizBackBtn.addEventListener("click", () => { showWelcomeOnly(); });

  UI.resultsBackBtn.addEventListener("click", () => {
    showQuiz();
    if (lastQuizAnswers) hydrateQuizAnswers(lastQuizAnswers);
  });

  UI.restartBtn.addEventListener("click", () => {
    lastQuizAnswers = null;
    lastQuizResult  = null;
    showQuiz();
    resetQuizToDefaults();
  });

  UI.quizForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.quizMsg, "");
    const answers = readQuizAnswers();
    lastQuizAnswers = answers;
    const result  = scoreQuiz(answers);
    lastQuizResult = result;
    showResults(result);
    await saveQuizToDatabase(answers, result);
  });

  // "Chat with AI" button on results panel
  UI.chatWithAIBtn.addEventListener("click", async () => {
    if (!lastQuizResult) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentUserId   = user.id;
        const meta      = user.user_metadata || {};
        currentUserName = meta.first_name || meta.last_name || "Friend";
        const { data: profile } = await supabase
          .from("users").select("first_name, last_name").eq("id", user.id).single();
        if (profile) currentUserName = profile.first_name || profile.last_name || currentUserName;
      }
    } catch (_) {}
    showChat();
    chatbot.start(lastQuizResult, currentUserName, currentUserId);
  });

  async function saveQuizToDatabase(answers, result) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const classAverages = result.classResults.map(r => ({
        classId: r.classId, label: r.label, avg: r.avg
      }));
      const { error } = await supabase.from("quiz_results").insert({
        user_id:            user.id,
        answers:            answers,
        class_averages:     classAverages,
        recommended_class:  result.winner.label,
      });
      if (error) console.error("Failed to save quiz results:", error.message);
      else       console.log("Quiz results saved successfully!");
    } catch (err) {
      console.error("Database connection error:", err);
    }
  }

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
      row.className      = "quizRow";
      row.dataset.itemId = item.id;
      const safeLabel  = escapeHtml(item.label);
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
          <input class="slider" type="range" min="${SLIDER_MIN}" max="${SLIDER_MAX}"
            step="${SLIDER_STEP}" value="${SLIDER_DEFAULT}"
            name="${escapeHtml(item.id)}" aria-label="${safeLabel}" />
          <span class="sliderHint">${SLIDER_MAX}</span>
        </div>`;
      UI.quizContainer.appendChild(row);
      const slider  = row.querySelector("input.slider");
      const valueEl = row.querySelector(".quizRow__value");
      slider.addEventListener("input", () => {
        valueEl.textContent = String(slider.value);
        updateProgress();
      });
    }
    updateProgress();
  }

  function resetQuizToDefaults() {
    UI.quizContainer.querySelectorAll("input.slider").forEach((s) => (s.value = String(SLIDER_DEFAULT)));
    UI.quizContainer.querySelectorAll(".quizRow").forEach((row) => {
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
    UI.quizContainer.querySelectorAll(".quizRow").forEach((row) => {
      const id     = row.dataset.itemId;
      const slider = row.querySelector("input.slider");
      answers[id]  = slider ? Number(slider.value) : SLIDER_DEFAULT;
    });
    return answers;
  }

  function hydrateQuizAnswers(answers) {
    UI.quizContainer.querySelectorAll(".quizRow").forEach((row) => {
      const id     = row.dataset.itemId;
      const slider = row.querySelector("input.slider");
      const vEl    = row.querySelector(".quizRow__value");
      const v      = Number(answers?.[id] ?? SLIDER_DEFAULT);
      if (slider) slider.value    = String(v);
      if (vEl)    vEl.textContent = String(v);
    });
    updateProgress();
  }

  function showResults(result) {
    hideAllPanels();
    UI.panelResults.classList.remove("hidden");
    UI.topSubtitle.textContent = "Your quiz results.";

    // Sort for display: worst (lowest avg) first
    const ordered = result.classResults.slice().sort((a, b) => a.avg - b.avg);

    UI.resultsGrid.innerHTML = "";
    for (const r of ordered) {
      const card = document.createElement("div");
      card.className = "resultCard";

      // Badge colour based on score direction
      let badge = "";
      if      (r.avg <= 3) badge = `<span class="resultBadge resultBadge--problem">Needs focus 🔴</span>`;
      else if (r.avg <= 6) badge = `<span class="resultBadge resultBadge--mid">Some issues 🟡</span>`;
      else                 badge = `<span class="resultBadge resultBadge--good">Doing well 💚</span>`;

      card.innerHTML = `
        <div class="resultCard__title">Class ${r.classId}: ${escapeHtml(r.label)} ${badge}</div>
        <div class="resultCard__meta">Sum: <strong>${r.sum}</strong> &nbsp;·&nbsp; Items: <strong>${r.count}</strong></div>
        <div class="resultCard__avg">Average: <strong>${format1(r.avg)}</strong> / 10
          <span class="resultCard__note">(lower = more to work on)</span>
        </div>`;
      UI.resultsGrid.appendChild(card);
    }

    UI.recommendChip.textContent = `Focus area: ${result.winner.label}`;
    UI.recommendBox.innerHTML = `
      <div class="recommendTitle">Suggested focus area</div>
      <div class="recommendMain">${escapeHtml(result.winner.label)}</div>
      <div class="recommendSub">
        This area scored lowest (<strong>${format1(result.winner.avg)}/10</strong>),
        meaning it needs the most attention.
        The chatbot will use this as the starting point for your conversation.
      </div>`;
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
    UI.panelChat.classList.add("hidden");
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
    UI.topSubtitle.textContent  = "You're all set.";
    UI.welcomeLine.textContent  = "Authentication successful.";
    UI.welcomeTitle.textContent = `Welcome, ${escapeHtml(profile.lastName)}! 💗`;
    UI.welcomeCompany.textContent     = p.name ? `Greetings from ${p.name}` : "Greetings from Partner";
    UI.welcomeCompanyLine.textContent = p.name ? `You are connected via ${p.name}.` : "";
    const logoEl = $("#welcomeLogo");
    if (logoEl) logoEl.textContent = p.logo || "LOVNITY";
  }

  function showChat() {
    hideAllPanels();
    UI.panelChat.classList.remove("hidden");
    UI.topSubtitle.textContent = "Chat with your AI companion.";
  }

  // -----------------------------
  // 7) HELPERS
  // -----------------------------
  function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("msg--error", "msg--success");
    if (type === "error")   el.classList.add("msg--error");
    if (type === "success") el.classList.add("msg--success");
  }

  function disableForm(form, text) {
    const btn = form.querySelector("button[type='submit']");
    if (btn) { btn.disabled = true; btn.textContent = text; }
  }

  function enableForm(form, text) {
    const btn = form.querySelector("button[type='submit']");
    if (btn) { btn.disabled = false; btn.textContent = text; }
  }

  function shake(el) {
    if (!el) return;
    el.animate([
      { transform: "translateX(0)"  }, { transform: "translateX(-8px)" },
      { transform: "translateX(8px)"}, { transform: "translateX(-6px)" },
      { transform: "translateX(6px)"}, { transform: "translateX(0)"   },
    ], { duration: 360, easing: "ease-out" });
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] || c
    ));
  }

  function attachPartnerAssets(partnerName) {
    const assets = partnerName && PARTNER_ASSETS[partnerName] ? PARTNER_ASSETS[partnerName] : {};
    return { name: partnerName || "Partner", logo: assets.logo || "" };
  }

  function format1(n) {
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }

  // -----------------------------
  // 8) INIT CHATBOT
  // -----------------------------
  const chatbot = initChatbot({
    supabase,
    panelChat:  UI.panelChat,
    onRestart: () => {
      lastQuizAnswers = null;
      lastQuizResult  = null;
      showQuiz();
      resetQuizToDefaults();
    },
    onLogout:   doLogout,
    escapeHtml,
    sleep,
  });

});
