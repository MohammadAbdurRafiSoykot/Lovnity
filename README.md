# 💗 Lovnity — AI Relationship Coach

Lovnity is a modern, serverless AI relationship coaching platform. It guides users through a relationship health quiz and seamlessly transitions them into a highly personalized, context-aware coaching session powered by Large Language Models (LLMs).

## ✨ Features

- **Relationship Health Quiz**: An 8-question, slider-based assessment that categorizes relationship friction into three core areas (Communication, Trust, Intimacy).
- **Personalized AI Coach**: The AI contextually adapts its opening greeting and coaching strategy based on the user's specific quiz results.
- **Dynamic Coaching Tracks**: The AI automatically routes between three distinct modes:
  - 🛋️ *Bot Counselor* (Emotional regulation & immediate support)
  - 🌱 *Self-Improvement* (Personal growth & behavioral patterns)
  - 🛠️ *Relationship Action* (Joint exercises & communication frameworks)
- **Progress Tracking Engine**: Tracks user sentiment across an "Action" and "Certainty" matrix to assess their psychological journey.
- **Enterprise Partner Mode**: Supports custom system prompts and clinical therapy referral triggers for partners like *Terveystalo*.
- **Robust Safety System**: Hardcoded crisis interception (Self-Harm/Violence) in English and Finnish, plus automated PII (Personal Identifiable Information) scrubbing before data reaches the LLM.

## 🏗️ Architecture (100% Serverless)

The application has been modernized to run entirely without a dedicated Node.js/Express backend. 

* **Frontend**: Vanilla HTML/CSS/JS. Communicates directly with Supabase for Auth and Edge Functions.
* **Backend**: Supabase Edge Functions (Deno/TypeScript). Handles LLM orchestration, safety checks, and routing.
* **Database**: Supabase PostgreSQL.
* **LLM Provider**: Groq API (`llama-3.3-70b-versatile`).

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Supabase JS Client
- **Edge Function**: Deno, TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq API, Llama 3.3 70B

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js and npm (for the Supabase CLI)
- Docker Desktop (required for local Edge Function testing)
- A [Supabase](https://supabase.com/) account
- A [Groq](https://console.groq.com/) API key

### 2. Database Setup
Run the following SQL in your Supabase SQL Editor to create the required tables:

\`\`\`sql
-- Quiz Results
CREATE TABLE quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  answers JSONB,
  class_averages JSONB,
  recommended_class TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Summaries (Generated when user types "END")
CREATE TABLE chat_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT NOT NULL,
  final_feedback TEXT,
  suggested_next_steps TEXT,
  quiz_context JSONB,
  turn_count INTEGER,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages (Memory for the Edge Function)
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
\`\`\`

### 3. Environment Variables
To run the Edge Function locally, create a `.env` file inside the `supabase/functions/` directory:

\`\`\`env
GROQ_API_KEY=your_groq_api_key
LLM_MODEL=llama-3.3-70b-versatile
SUPABASE_URL=your_local_or_live_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
\`\`\`

### 4. Running Locally

**Start the Backend (Edge Function):**
\`\`\`bash
# Initialize local Supabase stack (requires Docker)
npx supabase start

# Serve the function locally on port 54321
npx supabase functions serve chat-handler
\`\`\`

**Start the Frontend:**
Since the frontend is static, you can use any local web server. If you use VS Code, install the **Live Server** extension, right-click `frontend/index.html`, and select "Open with Live Server".

---

## ☁️ Deployment

### Backend (Supabase)
Deploy the Edge Function to your live Supabase project:
\`\`\`bash
# Link your project
npx supabase link --project-ref your-project-id

# Set your production secrets
npx supabase secrets set GROQ_API_KEY=your_key_here

# Deploy the function
npx supabase functions deploy chat-handler --no-verify-jwt
\`\`\`

### Frontend
The `frontend/` folder contains only static assets. It can be deployed for free to any static hosting provider such as:
- **Vercel**
- **Netlify**
- **GitHub Pages**

Just ensure the `supabaseUrl` and `supabaseAnonKey` in `frontend/app.js` point to your live Supabase project.

---

## 📂 Folder Structure

\`\`\`text
lovnity-chatbot/
├── frontend/                 # Client-side web application
│   ├── index.html            # Main UI (Login, Quiz, Chat)
│   ├── app.js                # UI logic & Supabase client integration
│   ├── quizLogic.js          # Pure quiz scoring algorithm
│   └── styles.css            # Lovnity UI styling
├── supabase/
│   └── functions/
│       └── chat-handler/     # Serverless Backend
│           └── index.ts      # Deno Edge Function (LLM Router, Safety, Tracks)
├── .gitignore                # Git exclusion rules
└── README.md                 # Project documentation
\`\`\`
