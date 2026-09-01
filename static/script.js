// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------
let selectedMood = null;
let selectedTags = new Set();
let moodChart = null;
let lastChatResult = null;
let breathingTimer = null;

// --------------------------------------------------------------------------
// Tab navigation — intentionally uses the tab/panel switching pattern
// supplied by the user.
// --------------------------------------------------------------------------
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".step-panel");

function activateTab(name) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === name;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${name}`);
  });

  if (name === "insight") loadHistory();
  if (name === "loop") loadLoop();
}

// Bridge used by the React dashboard cards/navigation.
window.spideyActivateTab = activateTab;

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetName = btn.dataset.goto;
    activateTab(targetName);

    // Navigation controls such as CHANGE MOOD scroll to their destination.
    // The seven main tabs themselves never scroll the page.
    requestAnimationFrame(() => {
      const targetPanel = document.getElementById(`panel-${targetName}`);
      targetPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
});

document.querySelectorAll("[data-tab-link]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    activateTab(link.dataset.tabLink);
  });
});

// --------------------------------------------------------------------------
// Spidey Boost — top-of-page daily reminder
// --------------------------------------------------------------------------
const boostQuotes = [
  { text: "You do not have to finish everything today to be moving forward.", author: "SpideyTingle" },
  { text: "Small steps still count. Keep building the web, one thread at a time.", author: "SpideyTingle" },
  { text: "A difficult day is one page, not the whole story.", author: "SpideyTingle" },
  { text: "Progress can be quiet. Notice it anyway.", author: "SpideyTingle" },
  { text: "Your future goals are built from the small choices you make today.", author: "SpideyTingle" },
  { text: "You can pause, reset, and still keep moving forward.", author: "SpideyTingle" },
];
let topQuoteIndex = new Date().getDate() % boostQuotes.length;
function renderTopBoost() {
  const q = boostQuotes[topQuoteIndex];
  const text = document.getElementById("top-motivation-quote");
  const author = document.getElementById("top-motivation-author");
  if (text) text.textContent = q.text;
  if (author) author.textContent = `— ${q.author}`;
}
const topQuoteNext = document.getElementById("top-quote-next");
if (topQuoteNext) topQuoteNext.addEventListener("click", () => { topQuoteIndex = (topQuoteIndex + 1) % boostQuotes.length; renderTopBoost(); });
renderTopBoost();

// --------------------------------------------------------------------------
// Diary sub-tabs — keeps the main 7-step navigation untouched
// --------------------------------------------------------------------------
const diaryTabs = document.querySelectorAll("[data-diary-tab]");
const diaryPanels = document.querySelectorAll(".diary-panel");
function activateDiaryTab(name) {
  diaryTabs.forEach((tab) => {
    const active = tab.dataset.diaryTab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  diaryPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `diary-panel-${name}`));
}
diaryTabs.forEach((tab) => tab.addEventListener("click", () => activateDiaryTab(tab.dataset.diaryTab)));

// --------------------------------------------------------------------------
// Mood check-in (The Tingle)
// --------------------------------------------------------------------------
const moodButtons = document.querySelectorAll(".mood-btn");
const checkinBtn = document.getElementById("checkin-btn");
const checkinStatus = document.getElementById("checkin-status");
const moodNote = document.getElementById("mood-note");
const tagChips = document.querySelectorAll(".tag-chip");

moodButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    moodButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedMood = {
      score: parseInt(btn.dataset.score, 10),
      label: btn.dataset.label,
    };
    checkinBtn.disabled = false;
    updateRecommendationMoodLabel();
    loadRecommendations();
  });
});

tagChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const tag = chip.dataset.tag;
    if (selectedTags.has(tag)) {
      selectedTags.delete(tag);
      chip.classList.remove("selected");
    } else {
      selectedTags.add(tag);
      chip.classList.add("selected");
    }
  });
});

checkinBtn.addEventListener("click", async () => {
  if (!selectedMood) return;

  checkinBtn.disabled = true;
  checkinStatus.textContent = "Saving...";

  try {
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood_score: selectedMood.score,
        mood_label: selectedMood.label,
        tags: Array.from(selectedTags),
        note: moodNote.value.trim(),
      }),
    });

    if (!res.ok) throw new Error("Failed to save check-in");

    checkinStatus.textContent = "Logged! Thanks for checking in. 🕸️";
    moodNote.value = "";
    moodButtons.forEach((b) => b.classList.remove("selected"));
    tagChips.forEach((c) => c.classList.remove("selected"));
    selectedTags.clear();
    selectedMood = null;
    checkinBtn.disabled = true;

    loadStats();
    loadFutureLetters();
  } catch (err) {
    checkinStatus.textContent = "Something went wrong — please try again.";
    checkinBtn.disabled = false;
    console.error(err);
  }
});

// --------------------------------------------------------------------------
// Stats bar
// --------------------------------------------------------------------------
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error("Stats request failed");
    const data = await res.json();

    document.getElementById("legacy-stat-streak").textContent =
      `${data.streak_days} ${data.streak_days === 1 ? "day" : "days"}`;
    document.getElementById("legacy-stat-average").textContent =
      data.avg_7 !== null ? `${data.avg_7}/5` : "–/5";
    document.getElementById("legacy-stat-today").textContent =
      data.today_logged ? "Logged" : "Not yet";
  } catch (err) {
    console.error("Could not load stats", err);
  }
}

// --------------------------------------------------------------------------
// Chat (The Vent) → feeds The Sense + The Nudge
// --------------------------------------------------------------------------
const chatWindow = document.getElementById("chat-window");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

function appendBubble(text, sender, flagged = false) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}` + (flagged ? " crisis" : "");
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  appendBubble(message, "user");
  chatInput.value = "";
  chatSend.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) throw new Error("Chat request failed");

    const data = await res.json();
    appendBubble(data.reply, "spidey", data.flagged);

    lastChatResult = data;
    renderSense(data);
    renderNudge(data);

    if (data.flagged) {
      activateTab("safety");
    }
  } catch (err) {
    appendBubble("Sorry, I couldn't respond right now. Please try again.", "spidey");
    console.error(err);
  } finally {
    chatSend.disabled = false;
  }
}

chatSend.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

document.querySelectorAll(".quick-prompts button").forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.dataset.prompt || "";
    chatInput.focus();
  });
});

// --------------------------------------------------------------------------
// The Sense
// --------------------------------------------------------------------------
function renderSense(data) {
  document.getElementById("sense-empty").classList.add("hidden");
  const result = document.getElementById("sense-result");
  result.classList.remove("hidden");

  const tag = document.getElementById("sense-category");
  tag.textContent = data.category;
  tag.className = `sense-tag category-${data.category}`;

  document.getElementById("sense-text").textContent = data.sense || "";

  const matchedWrap = document.getElementById("sense-matched-wrap");
  const matchedList = document.getElementById("sense-matched");
  matchedList.innerHTML = "";

  if (data.matched && data.matched.length) {
    matchedWrap.classList.remove("hidden");
    data.matched.forEach((word) => {
      const span = document.createElement("span");
      span.textContent = word;
      matchedList.appendChild(span);
    });
  } else {
    matchedWrap.classList.add("hidden");
  }
}

// --------------------------------------------------------------------------
// The Nudge + breathing widget
// --------------------------------------------------------------------------
function renderNudge(data) {
  document.getElementById("nudge-empty").classList.add("hidden");
  const card = document.getElementById("nudge-card");
  card.classList.remove("hidden");

  if (!data.nudge) return;

  document.getElementById("nudge-title").textContent = data.nudge.title;
  document.getElementById("nudge-body").textContent = data.nudge.body;

  const actionBtn = document.getElementById("nudge-action");
  actionBtn.textContent = data.nudge.action;

  const breathing = document.getElementById("breathing-widget");
  breathing.classList.add("hidden");
  stopBreathing();

  actionBtn.onclick = () => {
    if (data.category === "crisis") {
      activateTab("safety");
      return;
    }
    if (data.nudge.action.toLowerCase().includes("breath")) {
      breathing.classList.remove("hidden");
      startBreathing();
    } else if (data.category === "positive") {
      activateTab("tingle");
      moodNote.focus();
    }
  };
}

function startBreathing() {
  stopBreathing();
  const core = document.getElementById("breathing-core");
  const phase = document.getElementById("breathing-phase");
  let step = 0;
  const cycle = [
    { label: "Breathe in…", cls: "inhale", ms: 4000 },
    { label: "Hold…", cls: "inhale", ms: 4000 },
    { label: "Breathe out…", cls: "exhale", ms: 4000 },
    { label: "Hold…", cls: "exhale", ms: 4000 },
  ];

  function tick() {
    const current = cycle[step % cycle.length];
    core.className = `breathing-core ${current.cls}`;
    phase.textContent = current.label;
    step += 1;
    breathingTimer = setTimeout(tick, current.ms);
  }

  tick();
}

function stopBreathing() {
  if (breathingTimer) {
    clearTimeout(breathingTimer);
    breathingTimer = null;
  }
}

// --------------------------------------------------------------------------
// The Insight
// --------------------------------------------------------------------------
async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error("History request failed");
    const data = await res.json();

    const noDataMsg = document.getElementById("no-data-msg");
    const canvas = document.getElementById("mood-chart");

    if (!data.length) {
      noDataMsg.style.display = "block";
      canvas.style.display = "none";
      return;
    }

    noDataMsg.style.display = "none";
    canvas.style.display = "block";

    const labels = data.map((d) =>
      new Date(d.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    );
    const scores = data.map((d) => d.mood_score);

    if (moodChart) {
      moodChart.data.labels = labels;
      moodChart.data.datasets[0].data = scores;
      moodChart.update();
      return;
    }

    moodChart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Mood (1 = Tangled, 5 = Electric)",
          data: scores,
          borderColor: "#e0242c",
          backgroundColor: "rgba(224, 36, 44, 0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: "#f7c928",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 1,
            max: 5,
            ticks: { stepSize: 1, color: "#9aa0c4" },
            grid: { color: "rgba(244,241,234,0.08)" },
          },
          x: {
            ticks: { color: "#9aa0c4" },
            grid: { color: "rgba(244,241,234,0.05)" },
          },
        },
        plugins: {
          legend: { labels: { color: "#f4f1ea" } },
        },
      },
    });
  } catch (err) {
    console.error("Could not load mood history", err);
  }
}

// --------------------------------------------------------------------------
// The Loop
// --------------------------------------------------------------------------
const MOOD_ICONS = {
  Tangled: "🕸️",
  Heavy: "🌧️",
  Steady: "😐",
  Bright: "✨",
  "Electric": "🕷️",
};

async function loadLoop() {
  try {
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error("Loop request failed");
    const data = await res.json();

    const empty = document.getElementById("loop-empty");
    const list = document.getElementById("loop-list");
    list.innerHTML = "";

    if (!data.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    data.slice().reverse().forEach((entry) => {
      const row = document.createElement("div");
      row.className = "loop-entry";

      const icon = document.createElement("span");
      icon.className = "loop-icon";
      icon.textContent = MOOD_ICONS[entry.mood_label] || "🕸️";

      const body = document.createElement("div");
      body.className = "loop-body";

      const top = document.createElement("div");
      top.className = "loop-top";
      const dateStr = new Date(entry.created_at).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      const moodSpan = document.createElement("span");
      moodSpan.textContent = entry.mood_label;
      const dateSpan = document.createElement("span");
      dateSpan.className = "loop-date";
      dateSpan.textContent = dateStr;
      top.appendChild(moodSpan);
      top.appendChild(dateSpan);
      body.appendChild(top);

      if (entry.note) {
        const note = document.createElement("p");
        note.className = "loop-note";
        note.textContent = entry.note;
        body.appendChild(note);
      }

      if (entry.tags && entry.tags.length) {
        const tagsWrap = document.createElement("div");
        tagsWrap.className = "loop-tags";
        entry.tags.forEach((t) => {
          const span = document.createElement("span");
          span.textContent = t;
          tagsWrap.appendChild(span);
        });
        body.appendChild(tagsWrap);
      }

      row.appendChild(icon);
      row.appendChild(body);
      list.appendChild(row);
    });
  } catch (err) {
    console.error("Could not load the loop", err);
  }
}

// --------------------------------------------------------------------------
// The Vibe — mood-based music + movie recommendations
// --------------------------------------------------------------------------
function updateRecommendationMoodLabel() {
  const label = document.getElementById("recommendation-mood-label");
  if (!label) return;
  label.textContent = selectedMood
    ? `${selectedMood.label} · ${selectedMood.score}/5`
    : "Pick a mood in The Tingle";
}

function renderRecommendationList(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "recommendation-item";

    const title = document.createElement("h4");
    title.textContent = item.title;

    const meta = document.createElement("span");
    meta.className = "recommendation-meta";
    meta.textContent = type === "music" ? item.artist : item.meta;

    const why = document.createElement("p");
    why.textContent = item.why;

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(why);
    container.appendChild(card);
  });
}

async function loadRecommendations() {
  let mood = selectedMood?.label || "";
  let moodScore = selectedMood?.score || null;

  // If no mood has been selected in this session, use the latest check-in.
  if (!mood) {
    try {
      const historyRes = await fetch("/api/history");
      if (historyRes.ok) {
        const history = await historyRes.json();
        const latest = history[history.length - 1];
        if (latest) {
          mood = latest.mood_label || "Steady";
          moodScore = latest.mood_score || 3;
        }
      }
    } catch (err) {
      console.warn("Could not read latest mood for recommendations", err);
    }
  }

  mood = mood || "Steady";
  moodScore = moodScore || 3;

  const label = document.getElementById("recommendation-mood-label");
  if (label) {
    label.textContent = selectedMood || mood !== "Steady"
      ? `${mood} · ${moodScore}/5`
      : "Steady · 3/5 (default)";
  }

  try {
    const res = await fetch(`/api/recommendations?mood=${encodeURIComponent(mood)}`);
    if (!res.ok) throw new Error("Recommendation request failed");
    const data = await res.json();
    renderRecommendationList("music-recommendations", data.music, "music");
    renderRecommendationList("movie-recommendations", data.movies, "movie");
  } catch (err) {
    console.error("Could not load recommendations", err);
  }
}

// --------------------------------------------------------------------------
// The Diary — save + load personal journal pages
// --------------------------------------------------------------------------
const diaryEntry = document.getElementById("diary-entry");
const diaryTitle = document.getElementById("diary-title");
const diarySave = document.getElementById("diary-save");
const diaryStatus = document.getElementById("diary-status");
const diaryCount = document.getElementById("diary-count");

function updateDiaryCount() {
  if (!diaryEntry || !diaryCount) return;
  diaryCount.textContent = `${diaryEntry.value.length} / 5000`;
}

if (diaryEntry) {
  diaryEntry.addEventListener("input", updateDiaryCount);
}

if (diarySave) {
  diarySave.addEventListener("click", async () => {
    const entry = diaryEntry.value.trim();
    if (!entry) {
      diaryStatus.textContent = "Write a little something before saving your page.";
      diaryEntry.focus();
      return;
    }

    diarySave.disabled = true;
    diaryStatus.textContent = "Saving your page...";

    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: diaryTitle.value.trim(),
          entry,
          mood_label: selectedMood?.label || "",
          mood_score: selectedMood?.score || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Diary save failed");
      }

      diaryTitle.value = "";
      diaryEntry.value = "";
      updateDiaryCount();
      diaryStatus.textContent = "Page saved. Future-you has a little time capsule. 🕸️";
      await loadDiary();
    } catch (err) {
      diaryStatus.textContent = "Could not save the page — please try again.";
      console.error(err);
    } finally {
      diarySave.disabled = false;
    }
  });
}

function renderDiary(data) {
  const list = document.getElementById("diary-list");
  const empty = document.getElementById("diary-empty");
  if (!list || !empty) return;

  list.innerHTML = "";
  if (!data.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  data.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "diary-entry-card";

    const top = document.createElement("div");
    top.className = "diary-entry-top";

    const title = document.createElement("h4");
    title.textContent = entry.title || "Untitled page";

    const date = document.createElement("span");
    date.textContent = new Date(entry.created_at).toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });

    top.appendChild(title);
    top.appendChild(date);

    const mood = document.createElement("div");
    mood.className = "diary-entry-mood";
    mood.textContent = entry.mood_label
      ? `${MOOD_ICONS[entry.mood_label] || "🕸️"} ${entry.mood_label}${entry.mood_score ? ` · ${entry.mood_score}/5` : ""}`
      : "🕸️ No mood attached";

    const body = document.createElement("p");
    body.textContent = entry.entry;

    article.appendChild(top);
    article.appendChild(mood);
    article.appendChild(body);
    list.appendChild(article);
  });
}

async function loadDiary() {
  const date = document.getElementById("diary-date");
  if (date) {
    date.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  }

  try {
    const res = await fetch("/api/diary");
    if (!res.ok) throw new Error("Diary request failed");
    const data = await res.json();
    renderDiary(data);
  } catch (err) {
    console.error("Could not load diary", err);
  }
}

// --------------------------------------------------------------------------
// Initial load
// --------------------------------------------------------------------------
loadStats();
updateRecommendationMoodLabel();
updateDiaryCount();
loadRecommendations();
loadDiary();

// --------------------------------------------------------------------------
// Future Self — time-capsule letters, future goals and motivational quotes
// --------------------------------------------------------------------------
const futureLetterTitle = document.getElementById("future-letter-title");
const futureLetterEntry = document.getElementById("future-letter-entry");
const futureLetterDate = document.getElementById("future-letter-date");
const futureLetterSave = document.getElementById("future-letter-save");
const futureLetterStatus = document.getElementById("future-letter-status");
const futureLetterAlert = document.getElementById("future-letter-alert");
const futureLetterList = document.getElementById("future-letter-list");

const motivationQuotes = [
  { text: "You do not have to finish everything today to be moving forward.", author: "SpideyTingle" },
  { text: "Small steps still count. Keep building the web, one thread at a time.", author: "SpideyTingle" },
  { text: "A difficult day is one page, not the whole story.", author: "SpideyTingle" },
  { text: "Progress can be quiet. Notice it anyway.", author: "SpideyTingle" },
  { text: "Give future-you something kind to look back on.", author: "SpideyTingle" },
  { text: "You can pause without giving up on where you are going.", author: "SpideyTingle" },
  { text: "Start with the next doable thing. That is enough for now.", author: "SpideyTingle" },
  { text: "Your goals do not need perfect days; they need honest, repeatable steps.", author: "SpideyTingle" },
];

function selectedFutureTrigger() {
  return document.querySelector('input[name="future-trigger"]:checked')?.value || "low_mood";
}

function renderFutureLetters(payload) {
  if (!futureLetterAlert || !futureLetterList) return;
  const letters = payload.letters || [];
  const available = letters.filter((letter) => letter.available);

  futureLetterAlert.classList.toggle("hidden", available.length === 0);
  futureLetterAlert.innerHTML = "";

  if (available.length) {
    const title = document.createElement("strong");
    title.textContent = payload.low_mood_pattern
      ? "🕸️ A letter from future-you is waiting."
      : "📬 A future letter has arrived.";
    const copy = document.createElement("p");
    copy.textContent = "Take a moment to read the words you chose to leave for yourself.";
    futureLetterAlert.appendChild(title);
    futureLetterAlert.appendChild(copy);
  }

  futureLetterList.innerHTML = "";
  letters.slice(0, 6).forEach((letter) => {
    const card = document.createElement("article");
    card.className = `future-letter-card${letter.available ? " available" : " sealed"}`;

    const top = document.createElement("div");
    top.className = "future-letter-card-top";
    const heading = document.createElement("h4");
    heading.textContent = letter.title || "A note from future-you";
    const badge = document.createElement("span");
    badge.textContent = letter.available ? "OPEN NOW" : "SEALED";
    top.appendChild(heading);
    top.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "future-letter-meta";
    meta.textContent = letter.trigger_type === "date"
      ? `Set for ${new Date(`${letter.target_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
      : "Opens after a low-mood check-in pattern";

    const body = document.createElement("p");
    body.className = "future-letter-body";
    body.textContent = letter.available
      ? letter.entry
      : "This message is sealed until its chosen moment. Future-you has something waiting.";

    card.appendChild(top);
    card.appendChild(meta);
    card.appendChild(body);
    futureLetterList.appendChild(card);
  });
}

async function loadFutureLetters() {
  try {
    const res = await fetch("/api/future-letters");
    if (!res.ok) throw new Error("Future letter request failed");
    renderFutureLetters(await res.json());
  } catch (err) {
    console.error("Could not load future letters", err);
  }
}

if (futureLetterSave) {
  futureLetterSave.addEventListener("click", async () => {
    const entry = futureLetterEntry.value.trim();
    const trigger = selectedFutureTrigger();

    if (!entry) {
      futureLetterStatus.textContent = "Write something future-you would genuinely want to hear.";
      futureLetterEntry.focus();
      return;
    }

    if (trigger === "date" && !futureLetterDate.value) {
      futureLetterStatus.textContent = "Choose the date when you want the letter to arrive.";
      futureLetterDate.focus();
      return;
    }

    futureLetterSave.disabled = true;
    futureLetterStatus.textContent = "Sealing your time capsule...";

    try {
      const res = await fetch("/api/future-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: futureLetterTitle.value.trim(),
          entry,
          trigger_type: trigger,
          target_date: trigger === "date" ? futureLetterDate.value : "",
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Could not save letter");
      }

      futureLetterTitle.value = "";
      futureLetterEntry.value = "";
      futureLetterDate.value = "";
      futureLetterStatus.textContent = "Sealed. Future-you will find it at the right moment. 🕸️";
      await loadFutureLetters();
    } catch (err) {
      futureLetterStatus.textContent = "Could not seal the letter — please try again.";
      console.error(err);
    } finally {
      futureLetterSave.disabled = false;
    }
  });
}

document.querySelectorAll('input[name="future-trigger"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (futureLetterDate) {
      futureLetterDate.disabled = selectedFutureTrigger() !== "date";
    }
  });
});

if (futureLetterDate) {
  futureLetterDate.min = new Date().toISOString().split("T")[0];
  futureLetterDate.disabled = true;
}

// Goals
const goalInput = document.getElementById("goal-input");
const goalAdd = document.getElementById("goal-add");
const goalsList = document.getElementById("goals-list");
const goalsEmpty = document.getElementById("goals-empty");

function renderGoals(data) {
  if (!goalsList || !goalsEmpty) return;
  goalsList.innerHTML = "";
  goalsEmpty.classList.toggle("hidden", data.length > 0);

  data.forEach((item) => {
    const row = document.createElement("div");
    row.className = `goal-row${item.completed ? " completed" : ""}`;

    const button = document.createElement("button");
    button.className = "goal-check";
    button.type = "button";
    button.setAttribute("aria-label", item.completed ? "Mark goal incomplete" : "Mark goal complete");
    button.textContent = item.completed ? "✓" : "";
    button.addEventListener("click", async () => {
      await fetch(`/api/goals/${item.id}/toggle`, { method: "POST" });
      loadGoals();
    });

    const text = document.createElement("span");
    text.textContent = item.goal;

    row.appendChild(button);
    row.appendChild(text);
    goalsList.appendChild(row);
  });
}

async function loadGoals() {
  try {
    const res = await fetch("/api/goals");
    if (!res.ok) throw new Error("Goals request failed");
    renderGoals(await res.json());
  } catch (err) {
    console.error("Could not load goals", err);
  }
}

async function addGoal() {
  const goal = goalInput?.value.trim();
  if (!goal) return;
  goalAdd.disabled = true;
  try {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });
    if (!res.ok) throw new Error("Goal save failed");
    goalInput.value = "";
    await loadGoals();
  } catch (err) {
    console.error(err);
  } finally {
    goalAdd.disabled = false;
  }
}

if (goalAdd) goalAdd.addEventListener("click", addGoal);
if (goalInput) goalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addGoal();
});

// Motivational quote carousel
const quoteText = document.getElementById("motivation-quote");
const quoteAuthor = document.getElementById("motivation-author");
const quoteNext = document.getElementById("quote-next");
let quoteIndex = Math.floor(Math.random() * motivationQuotes.length);

function showQuote(index) {
  const quote = motivationQuotes[index];
  if (quoteText) quoteText.textContent = quote.text;
  if (quoteAuthor) quoteAuthor.textContent = `— ${quote.author}`;
}

if (quoteNext) {
  quoteNext.addEventListener("click", () => {
    quoteIndex = (quoteIndex + 1) % motivationQuotes.length;
    showQuote(quoteIndex);
  });
}

showQuote(quoteIndex);
loadFutureLetters();
loadGoals();

// --------------------------------------------------------------------------
// The Sixth Sense Lab — local voice-tone + typing-pattern analysis
// --------------------------------------------------------------------------
let voiceStream = null;
let voiceContext = null;
let voiceAnalyser = null;
let voiceFrame = null;
let voiceSampleTimer = null;
let voiceStartedAt = 0;
let voicePitchSamples = [];
let voiceEnergySamples = [];
let voicePauseCount = 0;
let voiceLastEnergy = 0;
let voiceWordCount = 0;
let voiceRecognition = null;
let voiceRecognitionSupported = false;

const voiceStart = document.getElementById("voice-start");
const voiceStop = document.getElementById("voice-stop");
const voiceStatus = document.getElementById("voice-status");
const voiceBadge = document.getElementById("voice-status-badge");
const voiceVisualizer = document.getElementById("voice-visualizer");

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function estimatePitch(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.012) return 0;

  let bestOffset = -1;
  let bestCorrelation = 0;
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.floor(sampleRate / 70);

  for (let lag = minLag; lag <= Math.min(maxLag, buffer.length - 1); lag++) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;
    const limit = buffer.length - lag;
    for (let i = 0; i < limit; i += 2) {
      const a = buffer[i];
      const b = buffer[i + lag];
      correlation += a * b;
      normA += a * a;
      normB += b * b;
    }
    const normalized = correlation / Math.sqrt((normA * normB) || 1);
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestOffset = lag;
    }
  }

  return bestOffset > 0 && bestCorrelation > 0.35 ? sampleRate / bestOffset : 0;
}

function sampleVoice() {
  if (!voiceAnalyser) return;
  const buffer = new Float32Array(voiceAnalyser.fftSize);
  voiceAnalyser.getFloatTimeDomainData(buffer);

  let sum = 0;
  let crossings = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
    if (i > 0 && ((buffer[i - 1] < 0 && buffer[i] >= 0) || (buffer[i - 1] >= 0 && buffer[i] < 0))) crossings++;
  }
  const rms = Math.sqrt(sum / buffer.length);
  const energy = Math.min(1, rms * 7);
  const pitch = estimatePitch(buffer, voiceContext.sampleRate);

  voiceEnergySamples.push(energy);
  if (pitch) voicePitchSamples.push(pitch);
  if (voiceLastEnergy > 0.04 && energy < 0.015) voicePauseCount++;
  voiceLastEnergy = energy;

  const bars = voiceVisualizer?.querySelectorAll("span") || [];
  bars.forEach((bar, index) => {
    const wobble = 0.55 + Math.abs(Math.sin(Date.now() / 180 + index)) * 0.45;
    bar.style.height = `${Math.max(10, 12 + energy * 55 * wobble)}px`;
    bar.style.opacity = `${0.35 + energy * 0.65}`;
  });
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;
  voiceRecognitionSupported = true;
  voiceRecognition = new Recognition();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = "en-IN";
  voiceRecognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript + " ";
    voiceWordCount = transcript.trim() ? transcript.trim().split(/\\s+/).length : 0;
  };
  voiceRecognition.onerror = () => {};
}
setupSpeechRecognition();

async function startVoiceAnalysis() {
  if (!navigator.mediaDevices?.getUserMedia) {
    voiceStatus.textContent = "Your browser does not provide microphone access for this demo.";
    return;
  }
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = voiceContext.createMediaStreamSource(voiceStream);
    voiceAnalyser = voiceContext.createAnalyser();
    voiceAnalyser.fftSize = 2048;
    source.connect(voiceAnalyser);

    voiceStartedAt = performance.now();
    voicePitchSamples = [];
    voiceEnergySamples = [];
    voicePauseCount = 0;
    voiceLastEnergy = 0;
    voiceWordCount = 0;

    voiceStart.disabled = true;
    voiceStop.disabled = false;
    voiceBadge.textContent = "LISTENING";
    voiceBadge.classList.add("live");
    voiceVisualizer.classList.add("active");
    voiceStatus.textContent = "Speak naturally for 10–20 seconds. You can say how your day went.";

    if (voiceRecognitionSupported) {
      try { voiceRecognition.start(); } catch (_) {}
    }

    const loop = () => {
      sampleVoice();
      voiceFrame = requestAnimationFrame(loop);
    };
    loop();
    voiceSampleTimer = setInterval(sampleVoice, 250);
  } catch (err) {
    voiceStatus.textContent = "Microphone permission was not available. No audio was recorded.";
    console.error(err);
  }
}

function stopVoiceAnalysis() {
  if (!voiceStream) return;
  const duration = Math.max(1, (performance.now() - voiceStartedAt) / 1000);
  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch (_) {}
  }
  if (voiceFrame) cancelAnimationFrame(voiceFrame);
  if (voiceSampleTimer) clearInterval(voiceSampleTimer);
  voiceFrame = null;
  voiceSampleTimer = null;
  voiceStream.getTracks().forEach((track) => track.stop());
  voiceStream = null;
  if (voiceContext) voiceContext.close().catch(() => {});
  voiceContext = null;
  voiceAnalyser = null;

  voiceStart.disabled = false;
  voiceStop.disabled = true;
  voiceBadge.textContent = "ANALYZED";
  voiceBadge.classList.remove("live");
  voiceVisualizer.classList.remove("active");
  voiceVisualizer.querySelectorAll("span").forEach((bar) => { bar.style.height = "18px"; bar.style.opacity = ".45"; });

  const pace = voiceWordCount ? (voiceWordCount / duration) * 60 : null;
  const energy = mean(voiceEnergySamples);
  const pitch = mean(voicePitchSamples);

  document.getElementById("voice-pace").textContent = pace ? `${Math.round(pace)} wpm` : "N/A";
  document.getElementById("voice-energy").textContent = energy ? `${Math.round(energy * 100)}%` : "N/A";
  document.getElementById("voice-pitch").textContent = pitch ? `${Math.round(pitch)} Hz` : "N/A";
  document.getElementById("voice-pauses").textContent = voicePauseCount;
  voiceStatus.textContent = "Voice metrics are ready. Click PREDICT MY MOOD SIGNAL for the demo estimate.";
  window.spideyVoiceMetrics = { pace, energy, pitch, pauses: voicePauseCount, duration };
}

if (voiceStart) voiceStart.addEventListener("click", startVoiceAnalysis);
if (voiceStop) voiceStop.addEventListener("click", stopVoiceAnalysis);

// Diary typing rhythm — counts broad interaction metrics only.
const typingState = { startedAt: 0, lastInputAt: 0, pauses: 0, backspaces: 0 };
function updateTypingAnalysis() {
  const entry = document.getElementById("diary-entry");
  if (!entry) return;
  const text = entry.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const elapsed = typingState.startedAt ? Math.max(1, (performance.now() - typingState.startedAt) / 60000) : 0;
  const wpm = elapsed && words ? words / elapsed : 0;
  document.getElementById("typing-pace").textContent = wpm ? `${Math.round(wpm)} wpm` : "—";
  document.getElementById("typing-pauses").textContent = typingState.pauses;
  document.getElementById("typing-backspaces").textContent = typingState.backspaces;
  document.getElementById("typing-words").textContent = words;
  window.spideyTypingMetrics = { wpm, pauses: typingState.pauses, backspaces: typingState.backspaces, words };
}

const diaryTypingEntry = document.getElementById("diary-entry");
if (diaryTypingEntry) {
  diaryTypingEntry.addEventListener("keydown", (event) => {
    const now = performance.now();
    if (!typingState.startedAt) typingState.startedAt = now;
    if (typingState.lastInputAt && now - typingState.lastInputAt > 1800) typingState.pauses++;
    if (event.key === "Backspace") typingState.backspaces++;
    typingState.lastInputAt = now;
  });
  diaryTypingEntry.addEventListener("input", updateTypingAnalysis);
}

function buildMoodPrediction() {
  const voice = window.spideyVoiceMetrics || {};
  const typing = window.spideyTypingMetrics || {};
  let stress = 0;
  const factors = [];

  if (voice.pace) {
    if (voice.pace > 175) { stress += 18; factors.push("faster speech"); }
    else if (voice.pace < 85) { stress += 10; factors.push("slower speech"); }
    else factors.push("steady speech pace");
  }
  if (voice.energy) {
    if (voice.energy < 0.16) { stress += 16; factors.push("lower vocal energy"); }
    else if (voice.energy > 0.48) { stress -= 10; factors.push("higher vocal energy"); }
  }
  if (voice.pitch) factors.push("voice pitch sampled");
  if (voice.pauses >= 4) { stress += 12; factors.push("more voice pauses"); }
  if (typing.wpm) {
    if (typing.wpm > 85) { stress += 8; factors.push("fast typing"); }
    else if (typing.wpm < 18) { stress += 8; factors.push("slow typing"); }
  }
  if (typing.pauses >= 3) { stress += 8; factors.push("writing pauses"); }
  if (typing.backspaces >= 12) { stress += 8; factors.push("more corrections"); }

  stress = Math.max(0, Math.min(100, stress + 35));
  let label = "Steady signal";
  let copy = "Your current interaction signals look fairly steady. Keep noticing what feels useful rather than treating the result as a verdict.";
  if (stress >= 70) {
    label = "Tangled signal";
    copy = "Some of the signals lean toward a more activated or weighed-down moment. A short pause, a chat with someone you trust, or a gentle reset may be useful.";
  } else if (stress >= 52) {
    label = "Heavy signal";
    copy = "A few signals lean toward a lower-energy or more pressured moment. Consider slowing down and checking in with yourself.";
  } else if (stress <= 25) {
    label = "Bright signal";
    copy = "Your interaction signals currently look more energetic and steady. Notice what helped and carry one small piece of it forward.";
  }
  return { label, copy, score: stress, factors: factors.slice(0, 5) };
}

const predictionButton = document.getElementById("run-mood-prediction");
if (predictionButton) {
  predictionButton.addEventListener("click", async () => {
    const prediction = buildMoodPrediction();
    document.getElementById("mood-prediction-empty").classList.add("hidden");
    document.getElementById("mood-prediction-result").classList.remove("hidden");
    document.getElementById("predicted-mood").textContent = prediction.label;
    document.getElementById("prediction-copy").textContent = prediction.copy;
    document.getElementById("prediction-meter-fill").style.width = `${prediction.score}%`;
    const factors = document.getElementById("prediction-factors");
    factors.innerHTML = "";
    (prediction.factors.length ? prediction.factors : ["not enough signal yet"]).forEach((factor) => {
      const span = document.createElement("span");
      span.textContent = factor;
      factors.appendChild(span);
    });

    try {
      await fetch("/api/mood-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predicted_label: prediction.label,
          signal_score: prediction.score,
          voice_pace: window.spideyVoiceMetrics?.pace,
          voice_energy: window.spideyVoiceMetrics?.energy,
          voice_pitch: window.spideyVoiceMetrics?.pitch,
          voice_pauses: window.spideyVoiceMetrics?.pauses || 0,
          typing_wpm: window.spideyTypingMetrics?.wpm,
          typing_pauses: window.spideyTypingMetrics?.pauses || 0,
          typing_backspaces: window.spideyTypingMetrics?.backspaces || 0,
        }),
      });
    } catch (err) {
      console.warn("Could not save mood analysis", err);
    }
  });
}

// ---------------------------------------------------------------------------
// SUPPORT CIRCLE + THERAPIST REPORT
// ---------------------------------------------------------------------------

const contactList = document.getElementById("contact-list");
const profileName = document.getElementById("profile-name");
const alertEnabled = document.getElementById("alert-enabled");
const alertThreshold = document.getElementById("alert-threshold");
const profileStatus = document.getElementById("profile-status");
const supportAlertStatus = document.getElementById("support-alert-status");
let trustedContacts = [];
let latestTherapistReport = null;

function renderContacts() {
  if (!contactList) return;
  contactList.innerHTML = "";
  trustedContacts.forEach((contact, index) => {
    const row = document.createElement("div");
    row.className = "contact-row";
    row.innerHTML = `
      <input class="comic-input contact-name" maxlength="80" placeholder="Name" value="${escapeHtml(contact.name || "")}">
      <input class="comic-input contact-email" maxlength="160" type="email" placeholder="Email" value="${escapeHtml(contact.email || "")}">
      <input class="comic-input contact-phone" maxlength="40" placeholder="Phone (optional)" value="${escapeHtml(contact.phone || "")}">
      <button class="remove-contact" type="button" aria-label="Remove trusted person">×</button>
    `;
    row.querySelector(".contact-name").addEventListener("input", e => trustedContacts[index].name = e.target.value);
    row.querySelector(".contact-email").addEventListener("input", e => trustedContacts[index].email = e.target.value);
    row.querySelector(".contact-phone").addEventListener("input", e => trustedContacts[index].phone = e.target.value);
    row.querySelector(".remove-contact").addEventListener("click", () => {
      trustedContacts.splice(index, 1);
      renderContacts();
    });
    contactList.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}

async function loadProfile() {
  try {
    const res = await fetch("/api/profile");
    const data = await res.json();
    if (profileName) profileName.value = data.user_name || "";
    trustedContacts = Array.isArray(data.contacts) ? data.contacts : [];
    if (alertEnabled) alertEnabled.checked = Boolean(data.alert_enabled);
    if (alertThreshold) alertThreshold.value = String(data.alert_threshold_days || 3);
    renderContacts();
    await loadSupportStatus();
  } catch (err) {
    console.warn("Could not load profile", err);
  }
}

const addContact = document.getElementById("add-contact");
if (addContact) {
  addContact.addEventListener("click", () => {
    if (trustedContacts.length >= 5) {
      profileStatus.textContent = "You can add up to 5 trusted people.";
      return;
    }
    trustedContacts.push({name: "", email: "", phone: ""});
    renderContacts();
  });
}

const saveProfile = document.getElementById("save-profile");
if (saveProfile) {
  saveProfile.addEventListener("click", async () => {
    saveProfile.disabled = true;
    profileStatus.textContent = "Saving your support circle...";
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          user_name: profileName?.value.trim() || "",
          contacts: trustedContacts,
          alert_enabled: Boolean(alertEnabled?.checked),
          alert_threshold_days: Number(alertThreshold?.value || 3)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save profile");
      profileStatus.textContent = "Support circle saved. Your alert preference is now active.";
      await loadSupportStatus();
    } catch (err) {
      profileStatus.textContent = err.message;
    } finally {
      saveProfile.disabled = false;
    }
  });
}

async function loadSupportStatus() {
  if (!supportAlertStatus) return;
  try {
    const res = await fetch("/api/support-status");
    const data = await res.json();
    if (!data.enabled) {
      supportAlertStatus.textContent = "Trusted-contact alerts are currently off.";
      return;
    }
    supportAlertStatus.textContent = data.triggered
      ? `A persistent low-mood/stress pattern is currently detected (recent average ${data.average}/5).`
      : `Monitoring is on: ${data.threshold_days} consecutive days are needed before a support alert can trigger.`;
  } catch (err) {
    supportAlertStatus.textContent = "Support status unavailable.";
  }
}

const testAlert = document.getElementById("test-alert");
if (testAlert) {
  testAlert.addEventListener("click", async () => {
    testAlert.disabled = true;
    profileStatus.textContent = "Testing the trusted-contact alert...";
    try {
      const res = await fetch("/api/support-alert/test", {method: "POST"});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.status || "Test alert failed");
      profileStatus.textContent = data.status;
    } catch (err) {
      profileStatus.textContent = err.message;
    } finally {
      testAlert.disabled = false;
    }
  });
}

function updateReportCards(report) {
  document.getElementById("report-checkins").textContent = report.check_ins ?? 0;
  document.getElementById("report-average").textContent = report.last_7_average_1_to_5 == null ? "—" : `${report.last_7_average_1_to_5}/5`;
  document.getElementById("report-diaries").textContent = report.diary_entries ?? 0;
  document.getElementById("report-tags").textContent = (report.common_context_tags || []).length;
  document.getElementById("report-summary").textContent = report.check_ins
    ? `Across ${report.check_ins} check-in${report.check_ins === 1 ? "" : "s"}, your recent 7-check average is ${report.last_7_average_1_to_5 ?? "—"}/5. Use the patterns below as conversation starters with your therapist or counselor.`
    : "There is not enough history yet. Keep checking in and journaling, then generate this report before a therapy session.";
  const highlights = document.getElementById("report-highlights");
  highlights.innerHTML = "";
  const items = [];
  if (report.lowest_recent_score != null) items.push(`Lowest recent check-in: ${report.lowest_recent_score}/5.`);
  if (report.highest_recent_score != null) items.push(`Highest recent check-in: ${report.highest_recent_score}/5.`);
  if ((report.common_context_tags || []).length) items.push(`Common contexts: ${report.common_context_tags.map(x => `${x[0]} (${x[1]})`).join(", ")}.`);
  if (report.chat_stress_or_support_signals) items.push(`${report.chat_stress_or_support_signals} recent chat entries contained stress/support-related signals.`);
  if (report.voice_typing_analyses) items.push(`${report.voice_typing_analyses} voice/typing wellness analyses were recorded as derived signals.`);
  if (!items.length) items.push("Keep building your timeline; the report becomes more useful as you add check-ins and diary pages.");
  items.forEach(text => {
    const div = document.createElement("div");
    div.className = "report-highlight";
    div.textContent = text;
    highlights.appendChild(div);
  });
}

async function generateTherapistReport() {
  const button = document.getElementById("generate-report");
  const printButton = document.getElementById("print-report");
  if (button) button.disabled = true;
  try {
    const res = await fetch("/api/therapist-report");
    latestTherapistReport = await res.json();
    updateReportCards(latestTherapistReport);
    if (printButton) printButton.disabled = false;
  } catch (err) {
    document.getElementById("report-summary").textContent = "Could not generate the report right now.";
  } finally {
    if (button) button.disabled = false;
  }
}

const reportButton = document.getElementById("generate-report");
if (reportButton) reportButton.addEventListener("click", generateTherapistReport);

const printReport = document.getElementById("print-report");
if (printReport) {
  printReport.addEventListener("click", () => {
    if (!latestTherapistReport) return;
    const r = latestTherapistReport;
    const tags = (r.common_context_tags || []).map(x => `<li>${escapeHtml(x[0])}: ${x[1]}</li>`).join("");
    const checkins = (r.recent_check_ins || []).map(x => `<tr><td>${escapeHtml(new Date(x.created_at).toLocaleString())}</td><td>${escapeHtml(x.mood_label)}</td><td>${x.mood_score}/5</td><td>${escapeHtml((x.note || "").slice(0, 160))}</td></tr>`).join("");
    const diaries = (r.recent_diary || []).map(x => `<article><h4>${escapeHtml(x.title || "Diary page")}</h4><small>${escapeHtml(new Date(x.created_at).toLocaleString())}</small><p>${escapeHtml(x.entry)}</p></article>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>SpideyTingle Therapist Report</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;color:#18233a;line-height:1.5}h1{margin-bottom:4px}h2{margin-top:28px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}article{padding:12px 0;border-bottom:1px solid #ddd}.notice{padding:12px;background:#f2f5fa;border-left:4px solid #2f8fff}@media print{body{margin:20px}}</style></head><body><h1>SpideyTingle — Therapist Reflection Report</h1><p>Generated ${escapeHtml(new Date(r.generated_at).toLocaleString())}</p><div class="notice">${escapeHtml(r.note)}</div><h2>Snapshot</h2><ul><li>Check-ins: ${r.check_ins}</li><li>Last 7-check average: ${r.last_7_average_1_to_5 ?? "—"}/5</li><li>Diary pages: ${r.diary_entries}</li><li>Stress/support chat signals: ${r.chat_stress_or_support_signals}</li><li>Voice/typing analyses: ${r.voice_typing_analyses}</li></ul><h2>Common contexts</h2><ul>${tags || "<li>No context tags yet.</li>"}</ul><h2>Recent check-ins</h2><table><thead><tr><th>Date</th><th>Mood</th><th>Score</th><th>Note</th></tr></thead><tbody>${checkins || "<tr><td colspan=4>No check-ins yet.</td></tr>"}</tbody></table><h2>Recent diary pages</h2>${diaries || "<p>No diary pages yet.</p>"}<h2>Discussion prompts</h2><ul>${(r.discussion_prompts || []).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul><script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  });
}

loadProfile();

// --------------------------------------------------------------------------
// Gen-Z interaction polish: progress, vibe mode, toasts, and tiny moments
// --------------------------------------------------------------------------
const stepNames = {
  tingle: "THE TINGLE", vent: "THE VENT", sense: "THE SENSE", nudge: "THE NUDGE",
  insight: "THE INSIGHT", loop: "THE LOOP", safety: "SAFETY NET"
};
const stepOrder = Object.keys(stepNames);
const progressFill = document.getElementById("journey-progress-fill");
const progressText = document.getElementById("journey-progress-text");
const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function updateJourneyProgress(name) {
  const index = Math.max(0, stepOrder.indexOf(name));
  if (progressFill) progressFill.style.width = `${((index + 1) / stepOrder.length) * 100}%`;
  if (progressText) progressText.textContent = `${index + 1} / ${stepOrder.length} · ${stepNames[name] || name}`;
}

// Patch the existing tab function so every existing navigation control updates progress.
const baseActivateTab = activateTab;
activateTab = function(name) {
  baseActivateTab(name);
  updateJourneyProgress(name);
};

const vibeModeBtn = document.getElementById("vibe-mode-btn");
if (vibeModeBtn) {
  vibeModeBtn.addEventListener("click", () => {
    const on = document.body.classList.toggle("vibe-mode");
    vibeModeBtn.setAttribute("aria-pressed", String(on));
    vibeModeBtn.textContent = on ? "🌈 VIBE MODE: ON" : "✨ VIBE MODE";
    showToast(on ? "Okayyy, the vibe is officially ON ✨" : "Back to classic Spidey mode 🕷️");
    localStorage.setItem("spidey-vibe-mode", on ? "1" : "0");
  });
  if (localStorage.getItem("spidey-vibe-mode") === "1") {
    document.body.classList.add("vibe-mode");
    vibeModeBtn.setAttribute("aria-pressed", "true");
    vibeModeBtn.textContent = "🌈 VIBE MODE: ON";
  }
}

const backTop = document.getElementById("back-to-top");
window.addEventListener("scroll", () => backTop?.classList.toggle("show", window.scrollY > 500), { passive: true });
backTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

moodButtons.forEach(btn => btn.addEventListener("click", () => {
  showToast(`${btn.dataset.label} selected. No notes, just vibes 🕷️`);
}));

// Keyboard shortcut: / jumps straight to The Vent.
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    e.preventDefault();
    activateTab("vent");
    setTimeout(() => chatInput?.focus(), 250);
  }
});

updateJourneyProgress("tingle");


// --------------------------------------------------------------------------
// Spidey Intelligence Hub — local, explainable pattern layer
// --------------------------------------------------------------------------
let intelligenceData = { moods: [], diaries: [] };
let resetInterval = null;

async function loadIntelligence() {
  try {
    const [moodsRes, diariesRes] = await Promise.all([fetch('/api/history'), fetch('/api/diary')]);
    if (!moodsRes.ok || !diariesRes.ok) throw new Error('Intelligence data unavailable');
    intelligenceData.moods = await moodsRes.json();
    intelligenceData.diaries = await diariesRes.json();
    renderEmotionalFingerprint();
    renderForecast();
    renderPatterns();
    if (!document.getElementById('reverse-body').dataset.generated) renderReverseJournal();
  } catch (err) { console.error('Could not load intelligence hub', err); }
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function scoreToPct(score){ return clamp(Math.round(((score-1)/4)*100),0,100); }

function renderEmotionalFingerprint(){
  const moods = intelligenceData.moods || [];
  const recent = moods.slice(-7);
  if (!recent.length) return;
  const scores = recent.map(x=>Number(x.mood_score));
  const mean = avg(scores);
  const latest = scores[scores.length-1];
  const energy = clamp(Math.round(scoreToPct(mean)),8,96);
  const stress = clamp(Math.round(100-scoreToPct(mean)),8,96);
  const socialTags = recent.reduce((n,m)=>n+((m.tags||[]).filter(t=>['friends','family','grateful','lonely'].includes(t)).length),0);
  const social = clamp(45 + socialTags*9 + (mean-3)*10,8,96);
  const momentum = clamp(50 + (latest-mean)*28 + (mean-3)*12,8,96);
  const values=[energy,stress,social,momentum];
  ['fp-energy','fp-stress','fp-social','fp-momentum'].forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=values[i]+'%'; const bar=document.querySelectorAll('.fp-bar i')[i]; if(bar) bar.style.width=values[i]+'%'; });
  const headline=document.getElementById('fingerprint-headline');
  const summary=document.getElementById('fingerprint-summary');
  const delta=latest-mean;
  if(delta <= -0.7){ headline.textContent='Your web feels heavier than your recent baseline.'; summary.textContent='Your latest check-in is noticeably below your recent average. That is a signal to pause and check in with yourself — not a label.'; }
  else if(delta >= 0.7){ headline.textContent='Your web has a little more lift today.'; summary.textContent='Your latest check-in is above your recent average. Notice what was different today — that can become useful personal knowledge.'; }
  else { headline.textContent='Your web is holding fairly steady.'; summary.textContent='Your latest check-in sits close to your recent personal baseline. Keep noticing what helps your days feel more like yours.'; }
}

function renderForecast(){
  const moods=intelligenceData.moods||[]; const recent=moods.slice(-5);
  const title=document.getElementById('forecast-title'), copy=document.getElementById('forecast-copy'), meter=document.getElementById('forecast-meter-fill'), factors=document.getElementById('forecast-factors');
  if(!recent.length){ return; }
  const mean=avg(recent.map(x=>Number(x.mood_score))); const trend=recent.length>1 ? Number(recent.at(-1).mood_score)-Number(recent[0].mood_score) : 0;
  let level='Mostly steady';
  if(mean<2.2 || trend<-1) level='Extra-care day'; else if(mean<3 || trend<0) level='Cloudy / mixed'; else if(mean>=4 || trend>1) level='Brighter window';
  title.textContent=level; copy.textContent='A short-range reflection based on your recent pattern. It is not a prediction of a mental-health condition.';
  const confidence=clamp(Math.round(50+Math.abs(trend)*18+(recent.length*5)),20,92); meter.style.width=confidence+'%';
  factors.innerHTML='';
  const tags={}; recent.forEach(m=>(m.tags||[]).forEach(t=>tags[t]=(tags[t]||0)+1));
  Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([tag,n])=>{ const s=document.createElement('span'); s.className='forecast-factor'; s.textContent=`${tag} · ${n}×`; factors.appendChild(s); });
  if(!factors.children.length){ const s=document.createElement('span'); s.className='forecast-factor'; s.textContent='No context tags yet'; factors.appendChild(s); }
}

function renderPatterns(){
  const list=document.getElementById('pattern-list'); if(!list) return; const counts={}; const moods=intelligenceData.moods||[];
  moods.forEach(m=>(m.tags||[]).forEach(t=>{ if(!counts[t]) counts[t]={n:0,sum:0}; counts[t].n++; counts[t].sum+=Number(m.mood_score); }));
  const rows=Object.entries(counts).map(([tag,v])=>({tag,n:v.n,mean:v.sum/v.n})).sort((a,b)=>a.mean-b.mean).slice(0,6);
  list.innerHTML='';
  if(!rows.length){ list.innerHTML='<div class="mini-empty">Check in a few times to reveal your recurring context patterns.</div>'; return; }
  rows.forEach(r=>{ const row=document.createElement('div'); row.className='pattern-row'; const label=document.createElement('span'); label.textContent=r.tag; const track=document.createElement('div'); track.className='pattern-track'; const i=document.createElement('i'); i.style.width=scoreToPct(r.mean)+'%'; track.appendChild(i); const val=document.createElement('strong'); val.textContent=r.mean.toFixed(1)+'/5'; row.append(label,track,val); list.appendChild(row); });
}

function renderReverseJournal(){
  const moods=intelligenceData.moods||[], diaries=intelligenceData.diaries||[];
  const title=document.getElementById('reverse-title'), body=document.getElementById('reverse-body'), chips=document.getElementById('reverse-highlights');
  if(!moods.length && !diaries.length){ title.textContent='Your story will appear here.'; body.textContent='After a few check-ins, Spidey can reflect the patterns back to you in plain language.'; return; }
  const recent=moods.slice(-7), scores=recent.map(m=>Number(m.mood_score)), mean=avg(scores);
  const first=scores[0], last=scores.at(-1), delta=last-first;
  title.textContent = delta>0.5 ? 'You have been finding a little more lift.' : delta<-0.5 ? 'You have been carrying a little more lately.' : 'Your recent story has been fairly steady.';
  body.textContent = `Across ${recent.length} recent check-in${recent.length===1?'':'s'}, your average was ${mean.toFixed(1)}/5. ${diaries.length ? `You also have ${diaries.length} diary page${diaries.length===1?'':'s'} to look back on.` : 'A few more diary pages will make this reflection richer.'}`;
  chips.innerHTML='';
  const tags={}; recent.forEach(m=>(m.tags||[]).forEach(t=>tags[t]=(tags[t]||0)+1));
  Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,4).forEach(([t,n])=>{ const s=document.createElement('span'); s.className='reverse-chip'; s.textContent=`${t} · ${n} check-in${n>1?'s':''}`; chips.appendChild(s); });
}

const refreshIntel=document.getElementById('refresh-intelligence');
if(refreshIntel) refreshIntel.addEventListener('click',()=>{ loadIntelligence(); refreshIntel.textContent='✓ SPIDEY SENSE REFRESHED'; setTimeout(()=>refreshIntel.textContent='🕷 REFRESH MY SPIDEY SENSE',1800); });
const generateReverse=document.getElementById('generate-reverse');
if(generateReverse) generateReverse.addEventListener('click',()=>{ const b=document.getElementById('reverse-body'); b.dataset.generated='1'; renderReverseJournal(); generateReverse.textContent='✓ REFLECTION UPDATED'; setTimeout(()=>generateReverse.textContent='WRITE MY REFLECTION',1600); });

// 2-minute reset
const resetPanel=document.getElementById('reset-panel'), resetStart=document.getElementById('reset-start'), resetClose=document.getElementById('reset-close');
if(document.getElementById('open-reset')) document.getElementById('open-reset').addEventListener('click',()=>resetPanel.classList.remove('hidden'));
if(resetClose) resetClose.addEventListener('click',()=>{ resetPanel.classList.add('hidden'); stopReset(); });
function stopReset(){ if(resetInterval){clearInterval(resetInterval); resetInterval=null;} }
if(resetStart) resetStart.addEventListener('click',()=>{
  stopReset(); let left=120, step=0; const timer=document.getElementById('reset-timer'), steps=[...document.querySelectorAll('.reset-step')]; resetStart.textContent='RESET RUNNING…';
  function paint(){ timer.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`; const idx=Math.min(3,Math.floor((120-left)/30)); steps.forEach((s,i)=>s.classList.toggle('active',i===idx)); }
  paint(); resetInterval=setInterval(()=>{left--;paint(); if(left<=0){stopReset();resetStart.textContent='✓ RESET COMPLETE';steps.forEach(s=>s.classList.remove('active'));steps[3].classList.add('active');setTimeout(()=>resetStart.textContent='START RESET',1800);}},1000);
});

// Opt-in emotional weather map
const weatherOptin=document.getElementById('weather-optin');
if(weatherOptin) weatherOptin.addEventListener('change',()=>{ const status=document.getElementById('weather-status'); status.textContent=weatherOptin.checked ? 'You joined the anonymous prototype pulse. Your individual mood is never displayed.' : 'Join is off by default. No individual mood is displayed.'; });

// Hardware demo state
function runDeviceDemo(){
  const labels=[['CHECK-IN READY','Tap the device to open a one-tap check-in.'],['CHECK-IN CAPTURED','Signal sent to SpideyTingle.'],['REFLECTION','Spidey is preparing a tiny next step.'],['READY AGAIN','Ambient signal returned to ready mode.']];
  let i=0; const state=document.getElementById('device-state-label'), copy=document.getElementById('device-state-copy'), led=document.getElementById('device-led');
  const paint=()=>{ state.textContent=labels[i][0]; copy.textContent=labels[i][1]; led.style.opacity=i===3?'.65':'1'; i=(i+1)%labels.length; }; paint(); const timer=setInterval(()=>{paint(); if(i===0)clearInterval(timer);},1000);
}
const deviceDemo=document.getElementById('device-demo'), deviceButton=document.getElementById('device-button');
if(deviceDemo) deviceDemo.addEventListener('click',runDeviceDemo);
if(deviceButton) deviceButton.addEventListener('click',runDeviceDemo);

// Load showcase data after the existing app initializes.
loadIntelligence();

/* Vibe Mode motion + micro-interactions */
(function () {
  const label = document.getElementById("recommendation-mood-label");
  const copy = document.getElementById("vibe-signal-copy");
  if (!label || !copy) return;

  const original = window.updateRecommendations;
  const messages = {
    "great": "Spidey signal is bright. Keep the good energy moving.",
    "good": "Your web is looking steady. Pick something that keeps you feeling good.",
    "okay": "No pressure. A small reset can be enough for now.",
    "low": "Let's slow the pace. You can choose something gentle.",
    "stressed": "Signal is buzzing. Take one small step before tackling everything."
  };

  function refreshVibe() {
    const mood = (label.textContent || "").toLowerCase();
    const key = Object.keys(messages).find(k => mood.includes(k));
    copy.textContent = key ? messages[key] : "Your vibe unlocks a different corner of the web.";
    copy.animate(
      [{ opacity: .35, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 420, easing: "ease-out" }
    );
  }

  const observer = new MutationObserver(refreshVibe);
  observer.observe(label, { childList: true, subtree: true, characterData: true });
  refreshVibe();
})();
