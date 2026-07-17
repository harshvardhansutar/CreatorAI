/**
 * script.js
 * UI logic: view switching, form handling, generation flow, response parsing,
 * card rendering, copy actions, history, templates, settings, export.
 */

(() => {
  const STORAGE_KEYS = {
    apiKey: "creatorai_api_key",
    model: "creatorai_model",
    history: "creatorai_history",
  };

  const TEMPLATES = [
    { name: "Cricket", category: "Cricket", tone: "Emotional" },
    { name: "Cricket 19", category: "Gaming", tone: "Casual" },
    { name: "Cricket 24", category: "Gaming", tone: "Casual" },
    { name: "BGMI", category: "Gaming", tone: "Funny" },
    { name: "Minecraft", category: "Gaming", tone: "Casual" },
    { name: "Valorant", category: "Gaming", tone: "Clickbait" },
    { name: "Movie Review", category: "Movies", tone: "Informative" },
    { name: "Tech Review", category: "Tech", tone: "Professional" },
    { name: "Programming", category: "Coding", tone: "Informative" },
    { name: "Coding Tutorial", category: "Coding", tone: "Professional" },
    { name: "Podcast", category: "Podcast", tone: "Casual" },
    { name: "History", category: "History", tone: "Informative" },
    { name: "Facts", category: "Education", tone: "Funny" },
    { name: "News", category: "News", tone: "Professional" },
    { name: "Finance", category: "Finance", tone: "Professional" },
    { name: "Travel", category: "Travel", tone: "Emotional" },
  ];

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const topicEl = $("topic"), categoryEl = $("category"), toneEl = $("tone"),
        languageEl = $("language"), platformEl = $("platform"), modelEl = $("model"),
        apiKeyEl = $("apiKey");
  const generateBtn = $("generateBtn"), generateBtnText = $("generateBtnText"),
        generateSpinner = $("generateSpinner"), generatingText = $("generatingText");
  const emptyState = $("emptyState"), resultsContainer = $("resultsContainer");
  const copyAllFab = $("copyAllFab"), toastEl = $("toast");

  let currentNiche = null;
  let lastSections = null; // parsed sections from most recent generation

  // ---------- Utilities ----------
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function loadSettings() {
    const key = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
    const model = localStorage.getItem(STORAGE_KEYS.model) || "openai/gpt-4.1-mini";
    apiKeyEl.value = key;
    modelEl.value = model;
    $("settingsApiKey").value = key;
    $("settingsModel").value = model;
  }

  function saveSettings(key, model) {
    localStorage.setItem(STORAGE_KEYS.apiKey, key);
    localStorage.setItem(STORAGE_KEYS.model, model);
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.history)) || []; }
    catch { return []; }
  }
  function saveHistory(list) {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(list.slice(0, 10)));
  }

  // ---------- Markdown section parsing ----------
  // Splits AI response into { "YouTube Titles": "...", "Description": "...", ... }
  function parseSections(markdown) {
    const sections = {};
    const lines = markdown.split("\n");
    let current = null;
    let buffer = [];

    const flush = () => {
      if (current) sections[current] = buffer.join("\n").trim();
      buffer = [];
    };

    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match) {
        flush();
        current = match[1].trim();
      } else {
        buffer.push(line);
      }
    }
    flush();
    return sections;
  }

  function countLines(text, prefixPattern) {
    return text.split("\n").filter((l) => prefixPattern.test(l.trim())).length;
  }

  // Very light heuristic scores, purely presentational.
  function computeSeoScore(sections) {
    let score = 40;
    if (sections["Tags"]) score += Math.min(20, sections["Tags"].split(",").length);
    if (sections["Keywords"]) score += 15;
    if (sections["Description"] && sections["Description"].length > 200) score += 15;
    if (sections["Hashtags"]) score += 10;
    return Math.max(0, Math.min(100, score));
  }
  function computeClickbaitScore(tone) {
    const map = { Clickbait: 90, Funny: 65, Emotional: 60, Casual: 45, Professional: 25, Informative: 30 };
    return map[tone] ?? 50;
  }

  function meterBar(pct) {
    const filled = Math.round(pct / 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
  }

  // ---------- Rendering ----------
  function renderSkeletons() {
    resultsContainer.innerHTML = "";
    const names = window.CreatorPrompts.OUTPUT_SECTIONS;
    names.forEach((name) => {
      const card = document.createElement("div");
      card.className = "card result-card skeleton-card";
      card.innerHTML = `
        <div class="skeleton-line" style="width:40%"></div>
        <div class="skeleton-line" style="width:90%"></div>
        <div class="skeleton-line" style="width:75%"></div>
      `;
      resultsContainer.appendChild(card);
    });
  }

  function textToHtml(text) {
    // Minimal, safe formatting: escape, then linebreaks + numbered/bullet lists.
    const escaped = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped;
  }

  function buildCard(title, bodyText, extraHtml = "") {
    const card = document.createElement("div");
    card.className = "card result-card";
    card.dataset.section = title;
    card.innerHTML = `
      <div class="result-card-header">
        <h3>${title}</h3>
        <div class="result-card-actions">
          <button class="icon-btn copy-btn">Copy</button>
          <button class="icon-btn regen-btn">Regenerate</button>
        </div>
      </div>
      <div class="result-card-body">${textToHtml(bodyText)}</div>
      ${extraHtml}
    `;
    card.querySelector(".copy-btn").addEventListener("click", (e) => {
      navigator.clipboard.writeText(bodyText).then(() => {
        const btn = e.target;
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
      });
    });
    card.querySelector(".regen-btn").addEventListener("click", () => regenerateSection(title));
    return card;
  }

  function renderResults(sections, meta) {
    resultsContainer.innerHTML = "";
    emptyState.style.display = "none";
    copyAllFab.hidden = false;
    $("exportRow").hidden = false;

    window.CreatorPrompts.OUTPUT_SECTIONS.forEach((name) => {
      const body = sections[name] || "(No content returned for this section.)";
      let extra = "";

      if (name === "YouTube Titles") {
        const firstTitle = body.split("\n").find((l) => l.trim())?.replace(/^\d+\.\s*/, "") || "";
        const warn = firstTitle.length > 100 ? "warn" : "";
        extra = `<div class="counter ${warn}">${firstTitle.length} / 100 characters (first title)</div>`;
      }
      if (name === "Description") {
        extra = `<div class="counter">${body.length} / 5000 characters</div>`;
      }
      if (name === "SEO Suggestions") {
        const seo = computeSeoScore(sections);
        extra = `
          <div class="meter">
            <div class="meter-label"><span>SEO Score</span><span>${seo}%</span></div>
            <div class="meter-track"><div class="meter-fill seo" style="width:${seo}%"></div></div>
          </div>`;
      }
      if (name === "Content Improvements") {
        const cb = computeClickbaitScore(meta.tone);
        extra = `
          <div class="meter">
            <div class="meter-label"><span>Clickbait Score</span><span>${cb}%</span></div>
            <div class="meter-track"><div class="meter-fill clickbait" style="width:${cb}%"></div></div>
          </div>`;
      }

      resultsContainer.appendChild(buildCard(name, body, extra));
    });
  }

  // ---------- Generation flow ----------
  async function generate(overrideTopic) {
    const topic = (overrideTopic ?? topicEl.value).trim();
    if (!topic) { toast("Enter a topic first."); topicEl.focus(); return; }

    const meta = {
      topic,
      category: categoryEl.value,
      tone: toneEl.value,
      language: languageEl.value,
      platform: platformEl.value,
      niche: currentNiche,
    };
    const apiKey = apiKeyEl.value.trim();
    const model = modelEl.value.trim();
    saveSettings(apiKey, model);

    setLoading(true);
    renderSkeletons();
    emptyState.style.display = "none";

    try {
      const { system, user } = window.CreatorPrompts.buildPrompt(meta);
      const raw = await window.CreatorAPI.callOpenRouter({ apiKey, model, system, user });
      const sections = parseSections(raw);
      lastSections = sections;
      renderResults(sections, meta);
      pushHistory(meta, sections);
    } catch (err) {
      resultsContainer.innerHTML = `<div class="card result-card"><div class="result-card-body">⚠ ${err.message}</div></div>`;
      copyAllFab.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  async function regenerateSection(sectionName) {
    const topic = topicEl.value.trim();
    if (!topic) return;
    const apiKey = apiKeyEl.value.trim();
    const model = modelEl.value.trim();
    const meta = { topic, category: categoryEl.value, tone: toneEl.value, language: languageEl.value, platform: platformEl.value, niche: currentNiche };

    const cardEl = [...resultsContainer.children].find((c) => c.dataset.section === sectionName);
    if (cardEl) cardEl.querySelector(".result-card-body").textContent = "Regenerating...";

    try {
      const { system, user } = window.CreatorPrompts.buildPrompt(meta);
      const raw = await window.CreatorAPI.callOpenRouter({ apiKey, model, system, user });
      const sections = parseSections(raw);
      lastSections = { ...lastSections, [sectionName]: sections[sectionName] };
      renderResults(lastSections, meta);
      toast(`${sectionName} regenerated.`);
    } catch (err) {
      toast(err.message);
    }
  }

  function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    generateSpinner.hidden = !isLoading;
    generatingText.hidden = !isLoading;
    generateBtnText.textContent = isLoading ? "Generating" : "Generate";
  }

  // ---------- History ----------
  function pushHistory(meta, sections) {
    const list = getHistory();
    list.unshift({ id: Date.now(), topic: meta.topic, date: new Date().toISOString(), meta, sections });
    saveHistory(list);
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    const container = $("historyList");
    if (!list.length) {
      container.innerHTML = `<p class="empty-history">No generations yet. Your history will appear here.</p>`;
      return;
    }
    container.innerHTML = "";
    list.forEach((item) => {
      const el = document.createElement("div");
      el.className = "history-item";
      const date = new Date(item.date).toLocaleString();
      el.innerHTML = `
        <div class="history-item-info">
          <strong>${item.topic}</strong>
          <span>${date}</span>
        </div>
        <div class="history-item-actions">
          <button class="icon-btn open-btn">Open</button>
          <button class="icon-btn delete-btn">Delete</button>
        </div>
      `;
      el.querySelector(".open-btn").addEventListener("click", () => openHistoryItem(item));
      el.querySelector(".delete-btn").addEventListener("click", () => {
        saveHistory(getHistory().filter((h) => h.id !== item.id));
        renderHistory();
        toast("History entry deleted.");
      });
      container.appendChild(el);
    });
  }

  function openHistoryItem(item) {
    topicEl.value = item.topic;
    categoryEl.value = item.meta.category;
    toneEl.value = item.meta.tone;
    languageEl.value = item.meta.language;
    platformEl.value = item.meta.platform;
    lastSections = item.sections;
    switchView("home");
    renderResults(item.sections, item.meta);
  }

  // ---------- Templates ----------
  function renderTemplates() {
    const grid = $("templateGrid");
    grid.innerHTML = "";
    TEMPLATES.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "template-card";
      btn.innerHTML = `<strong>${t.name}</strong><span>${t.category} · ${t.tone}</span>`;
      btn.addEventListener("click", () => {
        categoryEl.value = t.category;
        toneEl.value = t.tone;
        currentNiche = t.name;
        switchView("home");
        topicEl.focus();
        toast(`Template "${t.name}" applied.`);
      });
      grid.appendChild(btn);
    });
  }

  // ---------- View switching ----------
  const views = { home: $("homeView"), templates: $("templatesView"), history: $("historyView"), settings: $("settingsView") };
  function switchView(name) {
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    document.querySelectorAll(".nav-link").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    $("navLinks").classList.remove("open");
    if (name === "history") renderHistory();
    if (name === "templates") renderTemplates();
  }

  // ---------- Export / Copy All ----------
  function formatAllSections(sections) {
    return window.CreatorPrompts.OUTPUT_SECTIONS
      .map((name) => `# ${name}\n${sections[name] || ""}`)
      .join("\n\n");
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Event wiring ----------
  generateBtn.addEventListener("click", () => generate());
  topicEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  });

  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  $("hamburger").addEventListener("click", () => $("navLinks").classList.toggle("open"));

  copyAllFab.addEventListener("click", () => {
    if (!lastSections) return;
    navigator.clipboard.writeText(formatAllSections(lastSections)).then(() => toast("All sections copied!"));
  });

  $("downloadTxtBtn").addEventListener("click", () => {
    if (!lastSections) return;
    downloadFile("creator-ai-output.txt", formatAllSections(lastSections));
  });
  $("downloadMdBtn").addEventListener("click", () => {
    if (!lastSections) return;
    downloadFile("creator-ai-output.md", formatAllSections(lastSections));
  });

  $("saveSettingsBtn").addEventListener("click", () => {
    const key = $("settingsApiKey").value.trim();
    const model = $("settingsModel").value.trim();
    saveSettings(key, model);
    apiKeyEl.value = key;
    modelEl.value = model || modelEl.value;
    toast("Settings saved.");
  });

  $("clearHistoryBtn").addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
    toast("History cleared.");
  });

  // ---------- Init ----------
  loadSettings();
  renderTemplates();
  renderHistory();
  switchView("home");
})();
