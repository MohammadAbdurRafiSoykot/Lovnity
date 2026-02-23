document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  // -----------------------------
  // 1. INITIALIZE SUPABASE
  // -----------------------------
  const supabaseUrl = 'https://nytlbtwhmrvpzxqzusxg.supabase.co'; // <-- CHANGE THIS
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dGxidHdobXJ2cHp4cXp1c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzk2OTQsImV4cCI6MjA4NjgxNTY5NH0.mIx0MFqIHzL_zgpgLaDyImWgAAMoxRni2Nk-9iPYYzs';                   // <-- CHANGE THIS
  const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  const UI = {
    panelLogin: $("#panelLogin"),
    panelRegister: $("#panelRegister"),
    panelWelcome: $("#panelWelcome"),

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
    continueBtn: $("#continueBtn"),
    logoutBtn: $("#logoutBtn"),

    helpBtn: $("#helpBtn"),
    helpModal: $("#helpModal"),
    modalBackdrop: $("#modalBackdrop"),
    closeModal: $("#closeModal"),
    modalOk: $("#modalOk"),
  };

  // Logos live in frontend only. DB returns partner info;  map partner name -> logo here.
  const PARTNER_ASSETS = {
    "Terveystalo": {
      logo: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <circle cx="40" cy="40" r="38" fill="#005b8e" stroke="white" stroke-width="1.5"/>
        <text x="40" y="34" text-anchor="middle" fill="white" font-size="9" font-family="Arial" font-weight="bold">TERVEYSTALO</text>
        <path d="M28 42 h24 M40 30 v24" stroke="white" stroke-width="5" stroke-linecap="round"/>
      </svg>`
    },
    "Mehiläinen": {
      logo: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <circle cx="40" cy="40" r="38" fill="#e8890c" stroke="white" stroke-width="1.5"/>
        <text x="40" y="36" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="bold">MEHILÄINEN</text>
        <ellipse cx="40" cy="50" rx="10" ry="7" fill="white" opacity="0.9"/>
        <circle cx="40" cy="46" r="4" fill="#e8890c"/>
        <line x1="40" y1="28" x2="40" y2="38" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="32" y1="32" x2="40" y2="38" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="48" y1="32" x2="40" y2="38" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    },
    "Lovnity Partner": {
      logo: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
        <circle cx="40" cy="40" r="38" fill="#8b5cf6" stroke="white" stroke-width="1.5"/>
        <text x="40" y="44" text-anchor="middle" fill="white" font-size="12" font-family="Arial" font-weight="bold">LOVNITY</text>
      </svg>`
    },
  };

  // Check if user is already logged in on page load
  checkSession();

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchProfileAndShowWelcome(session.user);
    } else {
      showLogin();
    }
  }

  // ---------- Navigation ----------
  UI.goToRegisterBtn.addEventListener("click", showRegister);
  UI.backToLoginBtn.addEventListener("click", showLogin);

  // ---------- Restrict Code Input to Numbers ----------
  $("#inviteCodeInput").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  });

  // ---------- Login Logic ----------
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

  // ---------- Registration Logic ----------
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

    // 1. Pre-check the code so we can fail early on the frontend if it's wrong
    const { data: codeCheck, error: codeErr } = await supabase
      .from('partner_invites')
      .select('code')
      .eq('code', inviteCode)
      .eq('is_used', false)
      .single();

    if (codeErr || !codeCheck) {
      enableForm(UI.registerForm, "Sign Up");
      setMsg(UI.regMsg, "Invalid or already used invite code.", "error");
      shake(UI.panelRegister);
      return;
    }

    // 2. Register the user (Trigger handles the rest)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: surname,
          age: age,
          gender: gender,
          business_code: inviteCode // Matches our SQL trigger logic
        }
      }
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

// ---------- Welcome & Logout ----------
  async function fetchProfileAndShowWelcome(user) {
    if (!user) return;

    let lastName = "User";
    let partnerName = null;

    try {
      // 1. Try to fetch from the database (Ideal Scenario)
      const { data: profile, error } = await supabase
        .from('users')
        .select('last_name, business_partners(name)')
        .eq('id', user.id)
        .single();

      if (profile) {
        lastName = profile.last_name || lastName;
        partnerName = profile.business_partners?.name;
      } else {
        // 2. FALLBACK: If profile row is missing (Old account or DB trigger failed), check Auth Metadata directly!
        const meta = user.user_metadata || {};
        
        // Grab the name from the signup session data
        lastName = meta.last_name || meta.first_name || "User";
        
        // If they signed up with a code, look up the business name manually
        if (meta.business_code) {
          const { data: invite } = await supabase
            .from('partner_invites')
            .select('business_partners(name)')
            .eq('code', meta.business_code)
            .single();
            
          if (invite && invite.business_partners) {
            partnerName = invite.business_partners.name;
          }
        }
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }

    // Show the Welcome Screen with the finalized data
    showWelcome({ 
      lastName: lastName, 
      partner: attachPartnerAssets(partnerName) 
    });
  }

  UI.continueBtn.addEventListener("click", () => {
    alert("Next: route to your main app page.");
  });

  UI.logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    UI.loginForm.reset();
    UI.registerForm.reset();
    showLogin();
  });

  // ---------- Modals & UI Views ----------
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

  function showLogin() {
    UI.panelLogin.classList.remove("hidden");
    UI.panelRegister.classList.add("hidden");
    UI.panelWelcome.classList.add("hidden");
    UI.topSubtitle.textContent = "Sign in to your account.";
    setMsg(UI.loginMsg, "");
  }

  function showRegister() {
    UI.panelLogin.classList.add("hidden");
    UI.panelRegister.classList.remove("hidden");
    UI.panelWelcome.classList.add("hidden");
    UI.topSubtitle.textContent = "Create your new account.";
    setMsg(UI.regMsg, "");
  }

function showWelcome(profile) {
    UI.panelLogin.classList.add("hidden");
    UI.panelRegister.classList.add("hidden");
    UI.panelWelcome.classList.remove("hidden");

    const p = profile.partner || {};

    UI.topSubtitle.textContent = "You're all set.";
    UI.welcomeLine.textContent = "Authentication successful.";
    
    // CHANGED: Now using lastName
    UI.welcomeTitle.textContent = `Welcome, ${escapeHtml(profile.lastName)}! \u{1F497}`;

    UI.welcomeCompany.textContent = p.name ? `Greetings from ${p.name}` : "Greetings from Partner";
    UI.welcomeCompany.style.color = p.accent || "";

    const logoEl = $("#welcomeLogo");
    if (logoEl) logoEl.innerHTML = p.logo || "";

    const heart = $("#welcomeHeart");
    if (heart && p.accent) heart.style.setProperty("--heart-color", p.accent);
  }

  // ---------- Helpers ----------
  function setMsg(el, text, type) {
    el.textContent = text || "";
    el.classList.remove("msg--error", "msg--success");
    if (type === "error") el.classList.add("msg--error");
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
    el.animate([
      { transform: "translateX(0)" }, { transform: "translateX(-8px)" },
      { transform: "translateX(8px)" }, { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" }, { transform: "translateX(0)" }
    ], { duration: 360, easing: "ease-out" });
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c])); }

  function attachPartnerAssets(partnerName) {
    const assets = (partnerName && PARTNER_ASSETS[partnerName]) ? PARTNER_ASSETS[partnerName] : {};
    return { name: partnerName || "Partner", accent: assets.accent || "", logo: assets.logo || "" };
  }
});