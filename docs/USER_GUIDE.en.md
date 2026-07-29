# User Guide — Vocalis AI

🌐 **[Português (Brasil)](USER_GUIDE.md)** | **[English](USER_GUIDE.en.md)**

This guide explains how to install, configure, and use **Vocalis AI** during your meetings and technical interviews.

---

## 1. Prerequisites

- **Browser**: Google Chrome 120+ (or Chromium-based browser)
- **Node.js**: Version 20+
- **Python**: Version 3.10+ (optional if using Docker for Whisper transcription)
- **API Key**: Google Gemini (or OpenAI, Anthropic, DeepSeek, or local Ollama)

---

## 2. Installation Step-by-Step

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/edalicioh/vocalis-ai.git
cd vocalis-ai
npm install
```

### Step 2: Configure Environment Variables
```bash
cp ".env copy.example" .env
```

### Step 3: Build Monorepo
```bash
npm run build:types
npm run build:extension
npm run build:orchestrator
```

### Step 4: Load Extension in Chrome
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `apps/chrome-extension/dist`.

---

## 3. Meeting Operations

1. Join a call on Google Meet, Zoom Web, or Microsoft Teams.
2. Click the **Vocalis AI** extension icon and click **Start Capture**.
3. The floating HUD and Response Panel will appear over your screen.
4. Questions will automatically trigger contextual AI suggestions in real time.
