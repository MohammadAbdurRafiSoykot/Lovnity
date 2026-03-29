import {
  CLASS_META,
  QUIZ_ITEMS,
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_STEP,
  SLIDER_DEFAULT,
  scoreQuiz,
} from "./quizLogic.js";

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
    panelLogin:           $("#panelLogin"),
    panelRegister:        $("#panelRegister"),
    panelPartnerRegister: $("#panelPartnerRegister"),
    panelWelcome:         $("#panelWelcome"),
    panelQuiz:            $("#panelQuiz"),
    panelResults:         $("#panelResults"),
    panelChat:            $("#panelChat"),

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

  // "Join via partner invite" link shown when a partner code is typed in the normal register form
  const goToPartnerFlowBtn = $("#goToPartnerFlowBtn");
  if (goToPartnerFlowBtn) {
    goToPartnerFlowBtn.addEventListener("click", () => {
      showLogin();
      // Scroll the partner invite box into view smoothly
      setTimeout(() => {
        const box = $("#invitePartnerInput");
        if (box) { box.scrollIntoView({ behavior: "smooth", block: "center" }); box.focus(); }
      }, 100);
    });
  }

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

    // Block couple/partner codes — normal signup only accepts business codes
    const { data: isPartnerCode } = await supabase
      .rpc("check_couple_code", { input_code: inviteCode.toLowerCase() });

    if (isPartnerCode) {
      enableForm(UI.registerForm, "Sign Up");
      setMsg(UI.regMsg, "This is a partner invite code. Please use the partner join flow on the login page.", "error");
      const partnerLinkRow = $("#partnerLinkRow");
      if (partnerLinkRow) partnerLinkRow.style.display = "block";
      shake(UI.panelRegister);
      return;
    }

    // Validate against business_invites
    const { data: bizCheck, error: bizErr } = await supabase
      .rpc("check_business_code", { input_code: inviteCode.toLowerCase() });
    if (bizErr || !bizCheck) {
      enableForm(UI.registerForm, "Sign Up");
      setMsg(UI.regMsg, "Invalid or already used invite code.", "error");
      shake(UI.panelRegister);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name:      firstName,
          last_name:       surname,
          age,
          gender,
          business_code:   inviteCode.toLowerCase(),
          is_partner_join: false,
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

  // ── Partner register form ──────────────────────────────────────
  const partnerRegisterForm = $("#partnerRegisterForm");
  const partnerRegBackBtn   = $("#partnerRegBackBtn");

  if (partnerRegBackBtn) {
    partnerRegBackBtn.addEventListener("click", () => showLogin());
  }

  if (partnerRegisterForm) {
    partnerRegisterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const partnerRegMsg = $("#partnerRegMsg");
      setMsg(partnerRegMsg, "");

      const firstName  = $("#partnerFirstNameInput").value.trim();
      const surname    = $("#partnerSurnameInput").value.trim();
      const gender     = $("#partnerGenderInput").value.trim();
      const age        = Number($("#partnerAgeInput").value.trim());
      const email      = $("#partnerRegEmail").value.trim();
      const password   = $("#partnerRegPassword").value;
      const inviteCode = $("#partnerInviteCodeInput").value.trim();

      if (inviteCode.length !== 6) {
        setMsg(partnerRegMsg, "Partner invite code is missing. Please go back and try again.", "error");
        return;
      }

      disableForm(partnerRegisterForm, "Creating account...");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name:      firstName,
            last_name:       surname,
            age,
            gender,
            business_code:   inviteCode.toLowerCase(),
            is_partner_join: true,
          },
        },
      });

      if (error) {
        enableForm(partnerRegisterForm, "Sign Up");
        setMsg(partnerRegMsg, error.message, "error");
        return;
      }

      setMsg(partnerRegMsg, "Success! Logging you in...", "success");
      await sleep(400);
      await fetchProfileAndShowWelcome(data.user);
    });
  }

  // ── Partner invite flow ────────────────────────────────────────
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

      // Valid — switch to partner register panel with the code pre-filled
      setMsg(invitePartnerMsg, "Code accepted! Fill in your details below.", "success");
      await sleep(300);

      showPartnerRegister();

      // Pre-fill AND lock the partner invite code field
      const partnerCodeField = $("#partnerInviteCodeInput");
      if (partnerCodeField) {
        partnerCodeField.value    = code;
        partnerCodeField.readOnly = true;
      }

      setMsg($("#partnerRegMsg"), "💌 Joining your partner — your code has been filled in automatically.", "success");

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
    if (partnerRegisterForm) partnerRegisterForm.reset();
    enableForm(UI.loginForm,    "Log In");
    enableForm(UI.registerForm, "Sign Up");
    if (partnerRegisterForm) enableForm(partnerRegisterForm, "Sign Up");
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
            .select("first_name, last_name, age, gender, couple_code, couple_id")
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

          const codeRow      = $("#profileCodeRow");
          const shareRow     = $("#profileShareRow");
          const connectedRow = $("#profileConnectedRow");

          if (profile && profile.couple_code) {
            // PRIMARY USER — show code hidden by default
            const codeEl = $("#profileCoupleCode");
            codeEl.textContent = "••••••";
            codeRow.classList.remove("hidden");

            // Eye toggle — reset each time modal opens
            const toggleBtn = $("#toggleCodeBtn");
            let codeVisible = false;
            if (toggleBtn) {
              toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
              toggleBtn.onclick = () => {
                codeVisible = !codeVisible;
                codeEl.textContent = codeVisible ? profile.couple_code : "••••••";
                toggleBtn.innerHTML = codeVisible
                  ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
                  : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
              };
            }

            // Copy icon button
            const copyIconBtn = $("#copyIconBtn");
            if (copyIconBtn) {
              copyIconBtn.onclick = () => {
                navigator.clipboard.writeText(profile.couple_code).then(() => {
                  copyIconBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                  setTimeout(() => {
                    copyIconBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
                  }, 2000);
                });
              };
            }

            // Check if partner has already joined
            const { data: coupleRow } = await supabase
              .from("couples")
              .select("user2_id, is_partner_joined")
              .eq("id", profile.couple_id)
              .single();

            if (coupleRow?.is_partner_joined || coupleRow?.user2_id) {
              shareRow.classList.add("hidden");
              connectedRow.classList.remove("hidden");
            } else {
              connectedRow.classList.add("hidden");
              shareRow.classList.remove("hidden");

              $("#shareCodeBtn").onclick = () => {
                const code = profile.couple_code;
                if (navigator.share) {
                  navigator.share({
                    title: "Join me on Lovnity",
                    text: `Use my partner invite code to join me on Lovnity: ${code}`,
                  }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(code).then(() => {
                    $("#shareCodeBtn").textContent = "✅ Code copied!";
                    setTimeout(() => { $("#shareCodeBtn").textContent = "📤 Share Invite Code"; }, 2000);
                  });
                }
              };
            }
          } else {
            // PARTNER USER — hide code and share rows
            if (codeRow) codeRow.classList.add("hidden");
            if (shareRow) shareRow.classList.add("hidden");
            const { data: coupleRow } = await supabase
              .from("couples")
              .select("user2_id, is_partner_joined")
              .eq("user2_id", user.id)
              .single();
            if (connectedRow) {
              if (coupleRow?.is_partner_joined || coupleRow?.user2_id) {
                connectedRow.classList.remove("hidden");
              } else {
                connectedRow.classList.add("hidden");
              }
            }
          }
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
  let chatSessionId   = null;
  let chatQuizContext = null;
  let chatEnded       = false;
  let chatMessages    = [];

  const chatWindow      = UI.panelChat.querySelector("#chatWindow");
  const emotionChips    = UI.panelChat.querySelector("#emotionChips");
  const chatInputRow    = UI.panelChat.querySelector("#chatInputRow");
  const chatInput       = UI.panelChat.querySelector("#chatInput");
  const chatSendBtn     = UI.panelChat.querySelector("#chatSendBtn");
  const chatEndedBox    = UI.panelChat.querySelector("#chatEndedBox");
  const chatSummaryText = UI.panelChat.querySelector("#chatSummaryText");
  const chatRestartBtn  = UI.panelChat.querySelector("#chatRestartBtn");
  const chatLogoutBtn   = UI.panelChat.querySelector("#chatLogoutBtn");

  const CHAT_EMOTIONS = ["Happy 😊", "Anxious 😰", "Sad 😔", "Frustrated 😤", "Hopeful 🌱"];

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
    await startChatSession(lastQuizResult, currentUserName, currentUserId);
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
    UI.panelPartnerRegister.classList.add("hidden");
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
    const partnerLinkRow = $("#partnerLinkRow");
    if (partnerLinkRow) partnerLinkRow.style.display = "none";
  }

  function showPartnerRegister() {
    hideAllPanels();
    UI.panelPartnerRegister.classList.remove("hidden");
    UI.topSubtitle.textContent = "Join your partner on Lovnity.";
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
  // 7) CHAT INTEGRATION (no external chatbot.js)
  // -----------------------------
  function buildQuizContext(result) {
    const score = Math.round(result.winner.avg * 10);
    let lowestItem = null;
    let lowestScore = Infinity;
    if (lastQuizAnswers) {
      const winnerItems = QUIZ_ITEMS.filter((i) => i.classId === result.winner.classId);
      for (const item of winnerItems) {
        const v = Number(lastQuizAnswers[item.id] ?? SLIDER_DEFAULT);
        if (v < lowestScore) { lowestScore = v; lowestItem = item; }
      }
    }
    const keyInsight = lowestItem
      ? `User scored lowest in "${lowestItem.label}" (${lowestScore}/10), indicating a key friction point.`
      : `User shows challenges in ${result.winner.label} with average ${format1(result.winner.avg)}/10.`;
    return {
      score,
      problem_area: result.winner.label,
      key_insight: keyInsight,
    };
  }

  function scrollBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function addBubble(role, text) {
    const d = document.createElement("div");
    d.className = role === "assistant" ? "bubble bubble--bot" : "bubble bubble--user";
    if (role === "assistant") {
      d.innerHTML = escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
    } else {
      d.innerHTML = escapeHtml(text);
    }
    chatWindow.appendChild(d);
    scrollBottom();
  }

  function showTypingIndicator() {
    const d = document.createElement("div");
    d.className = "bubble bubble--typing";
    d.id = "lovnityTyping";
    d.innerHTML = '<div class="typingDots"><span></span><span></span><span></span></div>';
    chatWindow.appendChild(d);
    scrollBottom();
  }

  function removeTypingIndicator() {
    document.getElementById("lovnityTyping")?.remove();
  }

  function setChatInputEnabled(on) {
    chatInput.disabled = !on;
    chatSendBtn.disabled = !on;
  }


async function chatRequest(message) {
  const { data, error } = await supabase.functions.invoke('chat-handler', {
    body: {
      session_id: chatSessionId,
      user_id: currentUserId,
      message: message,
      quiz_context: chatQuizContext,
    }
  });

  if (error) {
    console.error("Edge Function Error:", error);
    throw new Error(error.message || "Could not reach the AI Coach");
  }

  return data;
}

  async function startChatSession(result, userName, userId) {
    chatEnded = false;
    chatMessages = [];
    chatQuizContext = buildQuizContext(result);
    chatSessionId = `${userId || "anon"}-${Date.now()}`;

    chatWindow.innerHTML = "";
    chatEndedBox.classList.add("hidden");
    chatInputRow.classList.remove("hidden");
    chatSummaryText.textContent = "";
    chatInput.value = "";
    setChatInputEnabled(false);

    emotionChips.innerHTML = "";
    CHAT_EMOTIONS.forEach((e) => {
      const btn = document.createElement("button");
      btn.className = "emotionBtn";
      btn.textContent = e;
      btn.addEventListener("click", () => sendChatMessage(e));
      emotionChips.appendChild(btn);
    });
    emotionChips.classList.remove("hidden");

    showTypingIndicator();
    await sleep(500);
    try {
      const r = await chatRequest("start");
      removeTypingIndicator();
      const greeting = r.reply || `Hi ${userName || "Friend"}, I'm here with you.`;
      addBubble("assistant", greeting);
      chatMessages.push({ role: "assistant", content: greeting });
    } catch (err) {
      removeTypingIndicator();
      addBubble("assistant", "I couldn't connect right now. Please try again in a moment.");
      console.error("Chat start failed:", err);
    } finally {
      setChatInputEnabled(true);
      chatInput.focus();
    }
  }

  async function endChatSession() {
    if (chatEnded) return;
    chatEnded = true;
    chatInputRow.classList.add("hidden");
    emotionChips.classList.add("hidden");

    showTypingIndicator();
    await sleep(400);
    removeTypingIndicator();

    try {
      const r = await chatRequest("END");
      const summary = r.final_feedback_summary;
      const feedback = summary?.final_feedback || r.reply || "Thank you for sharing today.";
      const nextSteps = summary?.suggested_next_steps || "";
      const fullSummary = nextSteps ? `${feedback}\n\nNext steps:\n${nextSteps}` : feedback;
      chatSummaryText.textContent = fullSummary;
    } catch (err) {
      chatSummaryText.textContent = "Could not generate summary right now. Please try again.";
      console.error("Summary failed:", err);
    }
    chatEndedBox.classList.remove("hidden");
    scrollBottom();
  }

  async function sendChatMessage(prefill = null) {
    const raw = prefill ?? chatInput.value;
    const text = String(raw || "").trim();
    if (!text || chatEnded) return;

    if (!prefill) chatInput.value = "";
    if (text.toUpperCase() === "END") {
      await endChatSession();
      return;
    }

    emotionChips.classList.add("hidden");
    addBubble("user", text);
    chatMessages.push({ role: "user", content: text });
    setChatInputEnabled(false);
    showTypingIndicator();

    try {
      const r = await chatRequest(text);
      removeTypingIndicator();
      const reply = r.reply || "I'm here with you. Tell me more.";
      addBubble("assistant", reply);
      chatMessages.push({ role: "assistant", content: reply });
    } catch (err) {
      removeTypingIndicator();
      addBubble("assistant", "I had trouble replying. Could you send that again?");
      console.error("Message failed:", err);
    } finally {
      setChatInputEnabled(true);
      chatInput.focus();
    }
  }

  // -----------------------------
  // 8) HELPERS
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

  chatSendBtn.addEventListener("click", () => sendChatMessage());
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  chatRestartBtn.addEventListener("click", () => {
    lastQuizAnswers = null;
    lastQuizResult = null;
    showQuiz();
    resetQuizToDefaults();
  });
  chatLogoutBtn.addEventListener("click", doLogout);

});