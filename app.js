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
  const supabaseUrl = "https://nytlbtwhmrvpzxqzusxg.supabase.co";
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dGxidHdobXJ2cHp4cXp1c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2OTQsImV4cCI6MjA4NjgxNTY5NH0.mIx0MFqIHzL_zgpgLaDyImWgAAMoxRni2Nk-9iPYYzs";
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
    panelChat: $("#panelChat"),
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
    chatWithAIBtn: $("#chatWithAIBtn"),

    personalInfoBtn: $("#personalInfoBtn"),
    personalInfoModal: $("#personalInfoModal"),
    personalInfoBackdrop: $("#personalInfoBackdrop"),
    closePersonalInfoModal: $("#closePersonalInfoModal"),
    personalInfoOkBtn: $("#personalInfoOkBtn"),
    savePersonalInfoBtn: $("#savePersonalInfoBtn"),
    personalInfoMsg: $("#personalInfoMsg"),
    infoNameInput: $("#infoNameInput"),
    infoAge: $("#infoAge"),
    infoGender: $("#infoGender"),
  };

  const invitePartnerInput = $("#invitePartnerInput");
  const invitePartnerBtn = $("#invitePartnerBtn");
  const invitePartnerMsg = $("#invitePartnerMsg");

  const inviteCodeInput = $("#inviteCodeInput");
  const loginEmail = $("#loginEmail");
  const loginPassword = $("#loginPassword");
  const firstNameInput = $("#firstNameInput");
  const surnameInput = $("#surnameInput");
  const genderInput = $("#genderInput");
  const ageInput = $("#ageInput");
  const regEmail = $("#regEmail");
  const regPassword = $("#regPassword");

  const chatRestartQuizBtn = $("#chatRestartQuizBtn");
  const chatLogoutBtn = $("#chatLogoutBtn");

  const PARTNER_ASSETS = {
    Terveystalo: { logo: "TERVEYSTALO" },
    "Mehiläinen": { logo: "MEHILÄINEN" },
    "Lovnity Partner": { logo: "LOVNITY" },
  };

  // -----------------------------
  // 3) APP STATE
  // -----------------------------
  let lastQuizAnswers = null;
  let lastQuizResult = null;
  let currentUserName = "Friend";
  let currentUserId = null;
  let chatbot = null;

  try {
    chatbot = initChatbot?.(supabase) || initChatbot?.() || null;
  } catch (err) {
    console.warn("Chatbot init warning:", err);
    chatbot = null;
  }

  // -----------------------------
  // 4) AUTH FLOW
  // -----------------------------
  checkSession();

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await fetchProfileAndShowWelcome(session.user);
    } else {
      showLogin();
    }
  }

  UI.goToRegisterBtn?.addEventListener("click", showRegister);
  UI.backToLoginBtn?.addEventListener("click", showLogin);

  if (inviteCodeInput) {
    inviteCodeInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    });
  }

  if (invitePartnerInput) {
    invitePartnerInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    });
  }

  UI.loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.loginMsg, "");

    const email = loginEmail?.value.trim() || "";
    const password = loginPassword?.value || "";

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

    enableForm(UI.loginForm, "Log In");
    await fetchProfileAndShowWelcome(data.user);
  });

  UI.registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.regMsg, "");

    const firstName = firstNameInput?.value.trim() || "";
    const surname = surnameInput?.value.trim() || "";
    const gender = genderInput?.value.trim() || "";
    const age = Number(ageInput?.value.trim() || "0");
    const email = regEmail?.value.trim() || "";
    const password = regPassword?.value || "";
    const inviteCode = inviteCodeInput?.value.trim() || "";

    if (!firstName || !surname || !gender || !age || !email || !password) {
      setMsg(UI.regMsg, "Please complete all fields.", "error");
      return;
    }

    if (inviteCode.length !== 6) {
      setMsg(UI.regMsg, "Invite code must be exactly 6 characters.", "error");
      return;
    }

    disableForm(UI.registerForm, "Creating account...");

    const { data: isPartnerCode } = await supabase.rpc("check_couple_code", {
      input_code: inviteCode.toLowerCase(),
    });

    if (!isPartnerCode) {
      const { data: bizCheck, error: bizErr } = await supabase.rpc("check_business_code", {
        input_code: inviteCode.toLowerCase(),
      });

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
          first_name: firstName,
          last_name: surname,
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

    enableForm(UI.registerForm, "Sign Up");
    setMsg(UI.regMsg, "Success! Logging you in...", "success");
    await sleep(400);
    await fetchProfileAndShowWelcome(data.user);
  });

  // -----------------------------
  // 5) PARTNER INVITE FLOW
  // -----------------------------
  if (invitePartnerBtn) {
    invitePartnerBtn.addEventListener("click", () => submitPartnerInvite());
  }

  if (invitePartnerInput) {
    invitePartnerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitPartnerInvite();
      }
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
      invitePartnerBtn.disabled = true;
      invitePartnerBtn.textContent = "Checking…";
    }

    try {
      const { data: isValid, error: rpcErr } = await supabase.rpc("check_couple_code", {
        input_code: code,
      });

      if (invitePartnerBtn) {
        invitePartnerBtn.disabled = false;
        invitePartnerBtn.textContent = "Join →";
      }

      if (rpcErr || !isValid) {
        setMsg(invitePartnerMsg, "Partner invite code not recognised. Please check the code.", "error");
        shake(invitePartnerInput.closest?.(".invitePartnerBox") || invitePartnerInput);
        return;
      }

      setMsg(invitePartnerMsg, "Code accepted! Fill in your details below.", "success");
      await sleep(300);
      showRegister();

      if (inviteCodeInput) {
        inviteCodeInput.value = code;
        inviteCodeInput.readOnly = true;
      }

      setMsg(UI.regMsg, "Joining your partner — your code has been filled in automatically.", "success");
    } catch (err) {
      console.error("submitPartnerInvite error:", err);

      if (invitePartnerBtn) {
        invitePartnerBtn.disabled = false;
        invitePartnerBtn.textContent = "Join →";
      }

      setMsg(invitePartnerMsg, "Could not verify code right now — try again shortly.", "error");
    }
  }

  // -----------------------------
  // 6) PROFILE + WELCOME
  // -----------------------------
  async function fetchProfileAndShowWelcome(user) {
    if (!user) return;

    let firstName = "Friend";
    let lastName = "User";
    let partnerName = null;

    try {
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, age, gender, business_partners(name)")
        .eq("id", user.id)
        .single();

      if (profile) {
        firstName = profile.first_name || firstName;
        lastName = profile.last_name || lastName;
        partnerName = profile.business_partners?.name || null;
      } else {
        const meta = user.user_metadata || {};
        firstName = meta.first_name || firstName;
        lastName = meta.last_name || lastName;

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

    currentUserId = user.id;
    currentUserName = firstName || lastName || "Friend";

    showWelcome({
      firstName,
      lastName,
      partner: attachPartnerAssets(partnerName),
    });
  }

  UI.continueBtn?.addEventListener("click", () => showQuiz());
  UI.logoutBtn?.addEventListener("click", doLogout);
  UI.logoutBtn2?.addEventListener("click", doLogout);
  chatLogoutBtn?.addEventListener("click", doLogout);

  async function doLogout() {
    await supabase.auth.signOut();

    UI.loginForm?.reset();
    UI.registerForm?.reset();

    if (inviteCodeInput) inviteCodeInput.readOnly = false;

    setMsg(UI.loginMsg, "");
    setMsg(UI.regMsg, "");
    setMsg(invitePartnerMsg, "");
    closePersonalInfoModal();
    closeHelpModal();

    lastQuizAnswers = null;
    lastQuizResult = null;

    showLogin();
  }

  // -----------------------------
  // 7) HELP MODAL
  // -----------------------------
  UI.helpBtn?.addEventListener("click", () => {
    UI.modalBackdrop?.classList.remove("hidden");
    UI.helpModal?.classList.remove("hidden");
  });

  function closeHelpModal() {
    UI.modalBackdrop?.classList.add("hidden");
    UI.helpModal?.classList.add("hidden");
  }

  UI.closeModal?.addEventListener("click", closeHelpModal);
  UI.modalOk?.addEventListener("click", closeHelpModal);
  UI.modalBackdrop?.addEventListener("click", closeHelpModal);

  // -----------------------------
  // 8) PERSONAL INFO MODAL
  // -----------------------------
  UI.personalInfoBtn?.addEventListener("click", openPersonalInfoModal);
  UI.closePersonalInfoModal?.addEventListener("click", closePersonalInfoModal);
  UI.personalInfoOkBtn?.addEventListener("click", closePersonalInfoModal);
  UI.personalInfoBackdrop?.addEventListener("click", closePersonalInfoModal);
  UI.savePersonalInfoBtn?.addEventListener("click", savePersonalInfo);

  function closePersonalInfoModal() {
    UI.personalInfoBackdrop?.classList.add("hidden");
    UI.personalInfoModal?.classList.add("hidden");
    setMsg(UI.personalInfoMsg, "");
  }

  async function openPersonalInfoModal() {
    setMsg(UI.personalInfoMsg, "");

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setMsg(UI.personalInfoMsg, "Could not load your account.", "error");
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("users")
        .select("first_name, last_name, age, gender")
        .eq("id", user.id)
        .single();

      if (profileErr) {
        console.error("Could not load personal info:", profileErr);
        setMsg(UI.personalInfoMsg, "Could not load your info.", "error");
        return;
      }

      const firstName = profile?.first_name || "";
      const lastName = profile?.last_name || "";
      const fullName = `${firstName} ${lastName}`.trim();

      if (UI.infoNameInput) UI.infoNameInput.value = fullName;
      if (UI.infoAge) UI.infoAge.textContent = profile?.age ?? "—";
      if (UI.infoGender) UI.infoGender.textContent = profile?.gender || "—";

      UI.personalInfoBackdrop?.classList.remove("hidden");
      UI.personalInfoModal?.classList.remove("hidden");
    } catch (err) {
      console.error("openPersonalInfoModal error:", err);
      setMsg(UI.personalInfoMsg, "Something went wrong.", "error");
    }
  }

  async function savePersonalInfo() {
    setMsg(UI.personalInfoMsg, "");

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setMsg(UI.personalInfoMsg, "Could not find your account.", "error");
        return;
      }

      const rawName = (UI.infoNameInput?.value || "").trim();

      if (!rawName) {
        setMsg(UI.personalInfoMsg, "Please enter your name.", "error");
        return;
      }

      const parts = rawName.split(/\s+/).filter(Boolean);
      const firstName = parts.shift() || "";
      const lastName = parts.join(" ");

      UI.savePersonalInfoBtn.disabled = true;
      UI.savePersonalInfoBtn.textContent = "Saving...";

      const { error: updateErr } = await supabase
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName,
        })
        .eq("id", user.id);

      UI.savePersonalInfoBtn.disabled = false;
      UI.savePersonalInfoBtn.textContent = "Save";

      if (updateErr) {
        console.error("Failed to save name:", updateErr);
        setMsg(UI.personalInfoMsg, "Could not save your name.", "error");
        return;
      }

      currentUserName = firstName || lastName || currentUserName;

      if (UI.welcomeLine) {
        UI.welcomeLine.textContent = `Welcome ${escapeHtml(firstName || lastName || "")}`.trim();
      }

      setMsg(UI.personalInfoMsg, "Name updated successfully.", "success");
    } catch (err) {
      console.error("savePersonalInfo error:", err);
      UI.savePersonalInfoBtn.disabled = false;
      UI.savePersonalInfoBtn.textContent = "Save";
      setMsg(UI.personalInfoMsg, "Something went wrong while saving.", "error");
    }
  }

  // -----------------------------
  // 9) QUIZ FLOW
  // -----------------------------
  UI.quizBackBtn?.addEventListener("click", () => {
    showWelcomeOnly();
  });

  UI.resultsBackBtn?.addEventListener("click", () => {
    showQuiz();
    if (lastQuizAnswers) hydrateQuizAnswers(lastQuizAnswers);
  });

  UI.restartBtn?.addEventListener("click", () => {
    lastQuizAnswers = null;
    lastQuizResult = null;
    showQuiz();
    resetQuizToDefaults();
  });

  chatRestartQuizBtn?.addEventListener("click", () => {
    lastQuizAnswers = null;
    lastQuizResult = null;
    showQuiz();
    resetQuizToDefaults();
  });

  UI.quizForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(UI.quizMsg, "");

    const answers = readQuizAnswers();
    lastQuizAnswers = answers;

    const result = scoreQuiz(answers);
    lastQuizResult = result;

    showResults(result);
    await saveQuizToDatabase(answers, result);
  });

  UI.chatWithAIBtn?.addEventListener("click", async () => {
    if (!lastQuizResult) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        currentUserId = user.id;

        const meta = user.user_metadata || {};
        currentUserName = meta.first_name || meta.last_name || "Friend";

        const { data: profile } = await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single();

        if (profile) {
          currentUserName = profile.first_name || profile.last_name || currentUserName;
        }
      }
    } catch (_) {}

    showChat();

    if (chatbot && typeof chatbot.start === "function") {
      chatbot.start(lastQuizResult, currentUserName, currentUserId);
    } else {
      const chatRoot = document.querySelector("#chatRoot");
      if (chatRoot) {
        chatRoot.innerHTML = `
          <div class="chatFallback">
            <p><strong>Focus area:</strong> ${escapeHtml(lastQuizResult.winner.label)}</p>
            <p>Your AI chat module is available in the repo, but it did not initialize here.</p>
          </div>
        `;
      }
    }
  });

  async function saveQuizToDatabase(answers, result) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const classAverages = result.classResults.map((r) => ({
        classId: r.classId,
        label: r.label,
        avg: r.avg,
      }));

      const { error } = await supabase.from("quiz_results").insert({
        user_id: user.id,
        answers,
        class_averages: classAverages,
        recommended_class: result.winner.label,
      });

      if (error) {
        console.error("Failed to save quiz results:", error.message);
      } else {
        console.log("Quiz results saved successfully!");
      }
    } catch (err) {
      console.error("Database connection error:", err);
    }
  }

  function showQuiz() {
    hideAllPanels();
    UI.panelQuiz?.classList.remove("hidden");
    if (UI.topSubtitle) UI.topSubtitle.textContent = "Quiz: slide to score each topic.";
    renderQuiz();
    resetQuizToDefaults();
  }

  function renderQuiz() {
    if (!UI.quizContainer) return;

    UI.quizContainer.innerHTML = "";

    for (const item of QUIZ_ITEMS) {
      const row = document.createElement("div");
      row.className = "quizRow";
      row.dataset.itemId = item.id;

      const safeLabel = escapeHtml(item.label);
      const classLabel = escapeHtml(CLASS_META[item.classId]?.label || `Class ${item.classId}`);

      row.innerHTML = `
        <div class="quizRowTop">
          <div>
            <div class="quizLabel">${safeLabel}</div>
            <div class="quizClass">Class ${item.classId}: ${classLabel}</div>
          </div>
          <div class="quizValue">${SLIDER_DEFAULT}</div>
        </div>

        <input
          class="quizSlider"
          type="range"
          min="${SLIDER_MIN}"
          max="${SLIDER_MAX}"
          step="${SLIDER_STEP}"
          value="${SLIDER_DEFAULT}"
          data-item-id="${escapeHtml(item.id)}"
        />

        <div class="quizScale">
          <span>${SLIDER_MIN}</span>
          <span>${SLIDER_MAX}</span>
        </div>
      `;

      const slider = row.querySelector(".quizSlider");
      const valueLabel = row.querySelector(".quizValue");

      slider?.addEventListener("input", () => {
        valueLabel.textContent = slider.value;
        updateQuizProgress();
      });

      UI.quizContainer.appendChild(row);
    }

    updateQuizProgress();
  }

  function readQuizAnswers() {
    const answers = {};

    document.querySelectorAll(".quizSlider").forEach((slider) => {
      answers[slider.dataset.itemId] = Number(slider.value);
    });

    return answers;
  }

  function hydrateQuizAnswers(answers) {
    document.querySelectorAll(".quizSlider").forEach((slider) => {
      const id = slider.dataset.itemId;
      if (Object.prototype.hasOwnProperty.call(answers, id)) {
        slider.value = String(answers[id]);
        const valueEl = slider.closest(".quizRow")?.querySelector(".quizValue");
        if (valueEl) valueEl.textContent = String(answers[id]);
      }
    });

    updateQuizProgress();
  }

  function resetQuizToDefaults() {
    document.querySelectorAll(".quizSlider").forEach((slider) => {
      slider.value = String(SLIDER_DEFAULT);
      const valueEl = slider.closest(".quizRow")?.querySelector(".quizValue");
      if (valueEl) valueEl.textContent = String(SLIDER_DEFAULT);
    });

    updateQuizProgress();
  }

  function updateQuizProgress() {
    const sliders = Array.from(document.querySelectorAll(".quizSlider"));
    const total = sliders.length;
    const completed = sliders.filter((s) => s.value !== "").length;

    if (UI.quizProgress) {
      UI.quizProgress.textContent = `${completed} / ${total}`;
    }
  }

  function showResults(result) {
    hideAllPanels();
    UI.panelResults?.classList.remove("hidden");

    if (UI.topSubtitle) {
      UI.topSubtitle.textContent = "Your quiz results.";
    }

    if (UI.resultsGrid) {
      UI.resultsGrid.innerHTML = "";
    }

    for (const r of result.classResults) {
      const badge = r.classId === result.winner.classId ? "⭐" : "";
      const card = document.createElement("div");
      card.className = "resultCard";
      card.innerHTML = `
        <h3>Class ${escapeHtml(String(r.classId))}: ${escapeHtml(r.label)} ${badge}</h3>
        <p>Sum: ${escapeHtml(String(r.sum))} · Items: ${escapeHtml(String(r.count))}</p>
        <p>Average: ${format1(r.avg)} / 10 (lower = more to work on)</p>
      `;
      UI.resultsGrid?.appendChild(card);
    }

    if (UI.recommendChip) {
      UI.recommendChip.textContent = `Focus area: ${result.winner.label}`;
    }

    if (UI.recommendBox) {
      UI.recommendBox.innerHTML = `
        <h3>Suggested focus area</h3>
        <p><strong>${escapeHtml(result.winner.label)}</strong></p>
        <p>
          This area has the lowest average score in your quiz, so it is the best place
          to focus first.
        </p>
      `;
    }
  }

  // -----------------------------
  // 10) VIEW HELPERS
  // -----------------------------
  function hideAllPanels() {
    UI.panelLogin?.classList.add("hidden");
    UI.panelRegister?.classList.add("hidden");
    UI.panelWelcome?.classList.add("hidden");
    UI.panelQuiz?.classList.add("hidden");
    UI.panelResults?.classList.add("hidden");
    UI.panelChat?.classList.add("hidden");
  }

  function showLogin() {
    hideAllPanels();
    UI.panelLogin?.classList.remove("hidden");
    if (UI.topSubtitle) UI.topSubtitle.textContent = "Sign in to your account.";
  }

  function showRegister() {
    hideAllPanels();
    UI.panelRegister?.classList.remove("hidden");
    if (UI.topSubtitle) UI.topSubtitle.textContent = "Create your Lovnity account.";
  }

  function showWelcome({ firstName, lastName, partner }) {
    hideAllPanels();
    UI.panelWelcome?.classList.remove("hidden");

    if (UI.topSubtitle) UI.topSubtitle.textContent = "Welcome";
    if (UI.welcomeLine) UI.welcomeLine.textContent = `Welcome ${firstName || lastName || "there"}`;
    if (UI.welcomeTitle) UI.welcomeTitle.textContent = "You’re in.";

    if (partner?.logo) {
      UI.welcomeCompanyLine?.classList.remove("hidden");
      if (UI.welcomeCompany) UI.welcomeCompany.textContent = partner.logo;
    } else {
      UI.welcomeCompanyLine?.classList.add("hidden");
      if (UI.welcomeCompany) UI.welcomeCompany.textContent = "LOVNITY";
    }
  }

  function showWelcomeOnly() {
    hideAllPanels();
    UI.panelWelcome?.classList.remove("hidden");
    if (UI.topSubtitle) UI.topSubtitle.textContent = "Welcome";
  }

  function showChat() {
    hideAllPanels();
    UI.panelChat?.classList.remove("hidden");
    if (UI.topSubtitle) UI.topSubtitle.textContent = "AI Chat";
  }

  function attachPartnerAssets(partnerName) {
    if (!partnerName) return null;
    return PARTNER_ASSETS[partnerName] || { logo: partnerName };
  }

  // -----------------------------
  // 11) GENERIC HELPERS
  // -----------------------------
  function setMsg(el, msg, type = "") {
    if (!el) return;
    el.textContent = msg || "";
    el.className = "formMsg";
    if (type) el.classList.add(type);
  }

  function disableForm(form, submitLabel = "Please wait...") {
    if (!form) return;
    const fields = form.querySelectorAll("input, select, textarea, button");
    fields.forEach((el) => (el.disabled = true));

    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.dataset.originalText = submit.textContent;
    if (submit) submit.textContent = submitLabel;
  }

  function enableForm(form, submitLabel = "") {
    if (!form) return;
    const fields = form.querySelectorAll("input, select, textarea, button");
    fields.forEach((el) => (el.disabled = false));

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.textContent = submitLabel || submit.dataset.originalText || submit.textContent;
    }

    if (inviteCodeInput?.readOnly) {
      inviteCodeInput.disabled = false;
    }
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function format1(n) {
    const num = Number(n);
    return Number.isFinite(num) ? num.toFixed(1) : "0.0";
  }
});
