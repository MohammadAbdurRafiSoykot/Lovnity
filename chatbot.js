/**
 * chatbot.js — Lovnity AI Chatbot
 * ════════════════════════════════════════════════════════════
 *
 * QUIZ SCORING CONTEXT:
 *   - Scores 1–10 per question. LOW = bigger problem in that area.
 *   - winner = class with LOWEST average = most problematic area.
 *   - Classes: 1=Communication, 2=Trust and Betrayal, 3=Sex and Intimacy
 *
 * FOR BACKEND TEAMMATE — wiring ChatGPT:
 *   Set CHAT_API_ENDPOINT to your backend URL.
 *   POST receives { messages, context } → return { reply: "string" }
 *
 * FOR SUPABASE TEAMMATE:
 *   See saveChatSession() near the bottom.
 * ════════════════════════════════════════════════════════════
 */

const CHAT_API_ENDPOINT = null; // e.g. "/api/chat"

const EMOTIONS = ["Happy 😊", "Anxious 😰", "Sad 😔", "Frustrated 😤", "Hopeful 🌱"];

function format1(n) {
  return (Math.round(Number(n) * 10) / 10).toFixed(1);
}

function getOverallAvg(classResults) {
  return (classResults.reduce((s, r) => s + r.avg, 0) / classResults.length).toFixed(1);
}

// Most problematic = LOWEST average
function getWorstClass(classResults) {
  return [...classResults].sort((a, b) => a.avg - b.avg)[0];
}

// Healthiest = HIGHEST average
function getBestClass(classResults) {
  return [...classResults].sort((a, b) => b.avg - a.avg)[0];
}

// Low score = struggling. High score = doing well.
function getScoreLabel(avg) {
  if (avg <= 3)  return "seriously struggling";
  if (avg <= 5)  return "having some difficulties";
  return "doing relatively well";
}

function buildGreeting(userName, quizResult) {
  const { winner, classResults } = quizResult;
  const overall  = getOverallAvg(classResults);
  const worst    = winner; // lowest avg = most problematic
  const topScore = format1(worst.avg);

  let insight;
  if (worst.avg <= 3) {
    insight = `I can see <strong>${worst.label}</strong> seems to be a significant challenge right now (score: ${topScore}/10).`;
  } else if (worst.avg <= 5) {
    insight = `It looks like <strong>${worst.label}</strong> might be an area worth exploring (score: ${topScore}/10).`;
  } else {
    insight = `Your scores look relatively stable overall — that's a good foundation to build from.`;
  }

  return `Hey ${userName} \u{1F497} \u2014 your overall average score is <strong>${overall}/10</strong>. ${insight}<br><br>How are you feeling at the moment?`;
}

function buildSummary(messages, quizResult) {
  const userMsgs = messages.filter((m) => m.role === "user").map((m) => m.content);
  const { winner, classResults } = quizResult;
  const overall = getOverallAvg(classResults);
  const best    = getBestClass(classResults); // highest avg = healthiest

  const emotionMsg = userMsgs.find((m) =>
    ["happy", "anxious", "sad", "frustrated", "hopeful"].some((e) => m.toLowerCase().includes(e))
  );

  let s = "📋 Summary of our conversation:\n\n";
  s += `• Overall relationship score: ${overall}/10\n`;
  s += `• Main area to work on: ${winner.label} (${format1(winner.avg)}/10 — lower = more to work on)\n`;
  s += `• Strongest area: ${best.label} (${format1(best.avg)}/10)\n`;
  if (emotionMsg) s += `• You mentioned feeling: ${emotionMsg}\n`;
  s += `• Messages shared: ${userMsgs.length}\n\n`;
  s += "Thank you for opening up today. Awareness is the first step toward growth. 💗";
  return s;
}

async function getBotReply(messages, context) {
  if (CHAT_API_ENDPOINT) {
    try {
      const res = await fetch(CHAT_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, context }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.reply || "I'm here with you. Tell me more.";
    } catch (err) {
      console.warn("API failed, using local fallback:", err);
    }
  }
  return localFallback(messages, context.quizResult);
}

function localFallback(messages, quizResult) {
  const last  = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const { winner, classResults } = quizResult;
  const worst = winner;                    // lowest avg = most problematic
  const best  = getBestClass(classResults); // highest avg = healthiest

  // Emotion responses
  if (last.includes("happy") || last.includes("😊")) {
    if (worst.avg <= 4) {
      return `That positivity is really valuable 😊 — even when things are tough. Even with <strong>${worst.label}</strong> being challenging right now, holding onto that happiness is a real strength. What's been making you feel good lately?`;
    }
    return `That's really good to hear! 😊 Your scores back that up too — especially around <strong>${best.label}</strong>. What do you feel is working well in your relationship right now?`;
  }

  if (last.includes("anxious") || last.includes("😰")) {
    return `Anxiety in a relationship is really common, especially when <strong>${worst.label}</strong> feels strained. 💙 That tension can sit with you even when nothing obvious is happening. What does the anxiety feel like — is it about specific situations, or more of a background feeling?`;
  }

  if (last.includes("sad") || last.includes("😔")) {
    return `I'm sorry you're feeling sad. 🌿 That heaviness is real, and it often shows up when we care deeply. Looking at your results, <strong>${worst.label}</strong> scored quite low — do you think that's connected to what you're feeling?`;
  }

  if (last.includes("frustrated") || last.includes("😤")) {
    return `Frustration often means you've been trying hard without seeing the change you need. 💪 With <strong>${worst.label}</strong> standing out most in your quiz, I can imagine that's been exhausting. What feels most stuck right now?`;
  }

  if (last.includes("hopeful") || last.includes("🌱")) {
    return `Hope is so important — it means you haven't given up. 🌱 And with <strong>${best.label}</strong> being a relative strength, there's a real foundation to build on. What does a hopeful outcome look like for you?`;
  }

  // Topic-specific responses matched to quiz classes
  if (last.includes("communicat")) {
    const c     = classResults.find(r => r.classId === 1);
    const score = c ? format1(c.avg) : "?";
    return `Communication scored <strong>${score}/10</strong> in your quiz — ${getScoreLabel(parseFloat(score))}. Even small shifts like saying "I feel…" instead of "You always…" can change the whole tone. What does communication usually look like between you two?`;
  }

  if (last.includes("trust") || last.includes("betray")) {
    const c     = classResults.find(r => r.classId === 2);
    const score = c ? format1(c.avg) : "?";
    return `Trust scored <strong>${score}/10</strong> — ${getScoreLabel(parseFloat(score))}. Trust is one of the hardest things to rebuild once it's been shaken. Is this something recent, or has it been a longer-standing feeling?`;
  }

  if (last.includes("intimacy") || last.includes("sex") || last.includes("physical") || last.includes("emotional")) {
    const c     = classResults.find(r => r.classId === 3);
    const score = c ? format1(c.avg) : "?";
    return `Intimacy scored <strong>${score}/10</strong> — ${getScoreLabel(parseFloat(score))}. Intimacy is deeply tied to feeling safe and seen. When that connection feels off, everything else gets harder too. What aspect of intimacy feels most distant right now?`;
  }

  // General responses
  if (last.includes("yes") || last.includes("yeah") || last.includes("sure"))
    return `I'm glad. Tell me more — I'm listening. 💙`;

  if (last.includes("no") || last.includes("not really") || last.includes("nope"))
    return `That's okay. There's no pressure here — we can go at whatever pace feels right for you.`;

  if (last.includes("don't know") || last.includes("idk") || last.includes("not sure"))
    return `That uncertainty is completely valid. Sometimes just sitting with the question is enough. What feels clearest to you, even if it's small?`;

  if (last.includes("thank"))
    return `You're so welcome. 💗 It takes real courage to reflect on these things. Is there anything else on your mind?`;

  if (last.includes("help") || last.includes("what should") || last.includes("advice"))
    return `I can reflect things back with you — though a relationship counsellor can go much deeper when you're ready. For now, based on your quiz, focusing on <strong>${worst.label}</strong> is where the most impact might be. What feels like the smallest possible first step?`;

  // Default fallbacks
  const defaults = [
    `That's really worth sitting with. How long have you been feeling this way?`,
    `Thank you for sharing that. Based on your results, <strong>${worst.label}</strong> stands out as the area needing most care — does what you just said connect to that?`,
    `I hear you. Sometimes saying it out loud is the first step. What feels most important to you right now?`,
    `That takes real self-awareness to recognise. What would feel like progress to you, even something small?`,
    `Every relationship moves through difficult seasons. What would you most want to be different?`,
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}


// Supabase save function matching the new ERD
async function saveChatSession(supabase, userId, { messages, summary, quizResult }) {
  if (!supabase || !userId) return;

  try {
    // 1. 生成一个唯一的 session_id 
    // 使用浏览器的 crypto API 生成 UUID，用来关联 session 和 messages
    const sessionId = crypto.randomUUID();

    // 2. 准备插入 coaching_sessions 表的数据
    // DB 中的 quiz_score 是 int4，我们需要把平均分转成整数
    const overallAvg = quizResult.classResults.reduce((s, r) => s + r.avg, 0) / quizResult.classResults.length;
    const roundedScore = Math.round(overallAvg); 
    
    // 从 quizResult 中提取最需要关注的领域作为 problem_area
    const problemArea = quizResult.winner.label;

    const sessionData = {
      session_id: sessionId,
      user_id: userId,
      final_feedback: summary,       // 将生成的长总结存入 feedback
      quiz_score: roundedScore,      // 存入四舍五入后的整数分数
      problem_area: problemArea,     // 对应关系图中的 problem_area
      turn_count: messages.length,   // 对话回合数
      // suggested_next_steps 和 key_insight 暂时留空，或者你可以让 AI 生成专门的字段
    };

    // 3. 准备批量插入 chat_messages 表的数据
    // 遍历 messages 数组，将每一条对象映射为数据库需要的格式
    const messagesToInsert = messages.map(msg => ({
      session_id: sessionId,
      user_id: userId,
      role: msg.role,
      content: msg.content
    }));

    // 4. 执行数据库插入 (先插 session，再插 messages)
    const { error: sessionError } = await supabase
      .from("coaching_sessions")
      .insert(sessionData);

    if (sessionError) throw new Error(`Session Insert Error: ${sessionError.message}`);

    const { error: messagesError } = await supabase
      .from("chat_messages")
      .insert(messagesToInsert);

    if (messagesError) throw new Error(`Messages Insert Error: ${messagesError.message}`);

    console.log("✅ Chat session and messages successfully saved to Supabase!");

  } catch (err) {
    console.error("❌ Failed to save chat session data:", err);
  }
}

// Supabase save stub
//async function saveChatSession(supabase, userId, { messages, summary, quizResult }) {
 // if (!supabase || !userId) return;
  // TODO (Supabase teammate): create table chat_sessions and uncomment:
  // const { error } = await supabase.from("chat_sessions").insert({
  //   user_id: userId, messages, summary, quiz_result: quizResult,
  // });
  // if (error) console.error("Failed to save chat session:", error.message);
 // console.log("[chatbot.js] saveChatSession stub — wire Supabase here.", { userId });
//}

// ══════════════════════════════════════════════════════════════
// initChatbot — exported, called once from app.js
// ══════════════════════════════════════════════════════════════
export function initChatbot({ supabase, panelChat, onRestart, onLogout, escapeHtml, sleep }) {

  const chatWindow      = panelChat.querySelector("#chatWindow");
  const emotionChips    = panelChat.querySelector("#emotionChips");
  const chatInputRow    = panelChat.querySelector("#chatInputRow");
  const chatInput       = panelChat.querySelector("#chatInput");
  const chatSendBtn     = panelChat.querySelector("#chatSendBtn");
  const chatEndedBox    = panelChat.querySelector("#chatEndedBox");
  const chatSummaryText = panelChat.querySelector("#chatSummaryText");
  const chatRestartBtn  = panelChat.querySelector("#chatRestartBtn");
  const chatLogoutBtn   = panelChat.querySelector("#chatLogoutBtn");

  let state = {
    ended: false,
    messages: [],
    quizResult: null,
    userName: "Friend",
    userId: null,
  };

  function scrollBottom() { chatWindow.scrollTop = chatWindow.scrollHeight; }

  function addBubble(role, html) {
    const d = document.createElement("div");
    d.className = role === "assistant" ? "bubble bubble--bot" : "bubble bubble--user";
    d.innerHTML = role === "assistant" ? html : escapeHtml(html);
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

  function removeTypingIndicator() { document.getElementById("lovnityTyping")?.remove(); }

  function setInputEnabled(on) {
    chatInput.disabled  = !on;
    chatSendBtn.disabled = !on;
  }

  async function start(quizResult, userName, userId) {
    state = { ended: false, messages: [], quizResult, userName: userName || "Friend", userId };

    chatWindow.innerHTML = "";
    chatEndedBox.classList.add("hidden");
    chatInputRow.classList.remove("hidden");
    chatSummaryText.textContent = "";
    chatInput.value = "";
    setInputEnabled(false);

    showTypingIndicator();
    await sleep(900);
    removeTypingIndicator();

    const greeting = buildGreeting(state.userName, quizResult);
    addBubble("assistant", greeting);
    state.messages.push({ role: "assistant", content: greeting });

    // Build emotion chips
    emotionChips.innerHTML = "";
    EMOTIONS.forEach((e) => {
      const btn = document.createElement("button");
      btn.className = "emotionBtn";
      btn.textContent = e;
      btn.addEventListener("click", () => send(e));
      emotionChips.appendChild(btn);
    });
    emotionChips.classList.remove("hidden");

    setInputEnabled(true);
    chatInput.focus();
  }

  async function send(text) {
    const t = text.trim();
    if (!t || state.ended) return;

    if (t.toLowerCase() === "end") {
      await endConversation();
      return;
    }

    emotionChips.classList.add("hidden");
    addBubble("user", t);
    state.messages.push({ role: "user", content: t });
    chatInput.value = "";
    setInputEnabled(false);
    showTypingIndicator();

    await sleep(800 + Math.random() * 700);

    let reply;
    try {
      reply = await getBotReply(state.messages, {
        userName:   state.userName,
        quizResult: state.quizResult,
      });
    } catch (err) {
      reply = "I'm having a little trouble right now. Could you say that again?";
    }

    removeTypingIndicator();
    addBubble("assistant", reply);
    state.messages.push({ role: "assistant", content: reply });
    setInputEnabled(true);
    chatInput.focus();
  }

  async function endConversation() {
    state.ended = true;
    chatInputRow.classList.add("hidden");
    emotionChips.classList.add("hidden");

    showTypingIndicator();
    await sleep(1000);
    removeTypingIndicator();

    const farewell = "Thank you for this conversation. 💗 Let me put together a short summary for you\u2026";
    addBubble("assistant", farewell);
    state.messages.push({ role: "assistant", content: farewell });

    await sleep(1200);

    const summary = buildSummary(state.messages, state.quizResult);
    chatSummaryText.textContent = summary;
    chatEndedBox.classList.remove("hidden");
    scrollBottom();

    await saveChatSession(supabase, state.userId, {
      messages:   state.messages,
      summary,
      quizResult: state.quizResult,
    });
  }

  chatSendBtn.addEventListener("click",  () => send(chatInput.value));
  chatInput.addEventListener("keydown",  (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(chatInput.value); }
  });
  chatRestartBtn.addEventListener("click", onRestart);
  chatLogoutBtn.addEventListener("click",  onLogout);

  return { start };
}
