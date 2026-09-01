"""
SpideyTingle backend
A lightweight Flask API that powers:
  1. The Tingle    — daily mood check-in (score + label + context tags + note)
  2. The Vent       — a casual rule-based AI companion chat
  3. The Sense      — reflects back what the companion picked up on
  4. The Nudge      — a small suggested action based on that read
  5. The Insight    — mood history for charting
  6. The Loop       — a scrollable log of past check-ins
  7. The Safety Net — always-on helpline info, auto-triggered by crisis language
"""

import os
import json
import sqlite3
import random
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone, timedelta

from flask import Flask, request, jsonify, g, render_template

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_DIR, "spideytingle.db")

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS moods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mood_score INTEGER NOT NULL,
            mood_label TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            note TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(moods)").fetchall()]
    if "tags" not in cols:
        conn.execute("ALTER TABLE moods ADD COLUMN tags TEXT DEFAULT '[]'")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,      -- 'user' or 'spidey'
            message TEXT NOT NULL,
            category TEXT DEFAULT 'neutral',
            flagged INTEGER DEFAULT 0, -- 1 if a safety-net response was triggered
            created_at TEXT NOT NULL
        )
        """
    )
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(chats)").fetchall()]
    if "category" not in cols:
        conn.execute("ALTER TABLE chats ADD COLUMN category TEXT DEFAULT 'neutral'")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS diary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT '',
            entry TEXT NOT NULL,
            mood_label TEXT DEFAULT '',
            mood_score INTEGER,
            created_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS future_letters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT '',
            entry TEXT NOT NULL,
            trigger_type TEXT NOT NULL DEFAULT 'low_mood',
            target_date TEXT DEFAULT '',
            opened INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS mood_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            predicted_label TEXT NOT NULL,
            signal_score INTEGER NOT NULL,
            voice_pace REAL,
            voice_energy REAL,
            voice_pitch REAL,
            voice_pauses INTEGER,
            typing_wpm REAL,
            typing_pauses INTEGER,
            typing_backspaces INTEGER,
            created_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            completed_at TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            user_name TEXT DEFAULT '',
            contacts TEXT DEFAULT '[]',
            alert_enabled INTEGER DEFAULT 0,
            alert_threshold_days INTEGER DEFAULT 3,
            updated_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS support_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reason TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            contacts TEXT NOT NULL,
            sent INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# "AI" companion logic (rule-based — swap in a real LLM call if you have an
# API key; see generate_reply() below for where to plug it in)
# ---------------------------------------------------------------------------

CRISIS_KEYWORDS = [
    "kill myself", "end my life", "suicide", "want to die", "hurt myself",
    "self harm", "self-harm", "no reason to live", "can't go on",
]

STRESS_KEYWORDS = [
    "stressed", "stress", "anxious", "anxiety", "overwhelmed", "exhausted",
    "burnt out", "burned out", "tired", "can't sleep", "panic", "pressure",
    "lonely", "alone", "sad", "hopeless", "worthless", "crying", "cry",
]

POSITIVE_KEYWORDS = [
    "happy", "great", "good", "excited", "grateful", "calm", "relaxed",
    "proud", "accomplished", "fine", "okay", "content",
]

STRESS_REPLIES = [
    "That sounds like a lot to carry. Want to try a 4-7-8 breath with me — in for 4, hold for 7, out for 8?",
    "I hear you. Sometimes naming the feeling takes a little of its weight away. What's the biggest thing on your mind right now?",
    "Rough patch, huh? A two-minute grounding exercise might help: name 5 things you can see, 4 you can touch, 3 you can hear.",
    "That's tough. You don't have to fix it right now — just noticing it is a good first step. Want a short break reminder in 10 minutes?",
]

POSITIVE_REPLIES = [
    "Love that energy! What made today click for you?",
    "That's great to hear. Want to jot down what's working so future-you can look back on it?",
    "Nice! Small wins add up — thanks for sharing it with me.",
]

NEUTRAL_REPLIES = [
    "Thanks for checking in. Anything on your mind today?",
    "I'm here if you want to talk it through — no pressure either way.",
    "Got it. How's your energy level today, on a scale of 1-10?",
]

CRISIS_REPLY = (
    "I'm really glad you told me this, and I want you to be safe. I'm not able to provide "
    "the support you need right now, but you deserve to talk to someone who can help immediately. "
    "If you're in India, you can call the KIRAN mental health helpline at 1800-599-0019 (toll-free, 24/7), "
    "or reach a trusted person nearby right now. If you're outside India, please contact your local "
    "emergency number or a crisis line where you are. If you're in immediate danger, please call your "
    "local emergency number now."
)

# Small library of "Nudge" suggestions keyed by category, used by Step 4.
NUDGES = {
    "crisis": {
        "title": "Reach out right now",
        "body": "This isn't something to sit with alone. Use the Safety Net tab for helpline numbers, or contact someone you trust immediately.",
        "action": "Open Safety Net",
    },
    "stress": {
        "title": "60-second reset",
        "body": "Try box breathing: in for 4, hold for 4, out for 4, hold for 4. Repeat it four times before you go back to what you were doing.",
        "action": "Start breathing",
    },
    "positive": {
        "title": "Bank the win",
        "body": "Write one line about what made today good. Future-you, on a harder day, will want to read it back.",
        "action": "Log a note",
    },
    "neutral": {
        "title": "Quick check-in",
        "body": "Not much going on either way? That's a fine place to be. Take a slow breath and notice how your body feels right now.",
        "action": "Take a breath",
    },
}

SENSE_COPY = {
    "crisis": "It sounds like things feel really heavy right now, maybe even unsafe.",
    "stress": "I'm picking up some stress or tension in what you shared.",
    "positive": "That reads as a genuinely good moment — nice.",
    "neutral": "Nothing urgent jumping out — just an ordinary check-in.",
}


def classify_message(text: str):
    lowered = text.lower()

    if any(kw in lowered for kw in CRISIS_KEYWORDS):
        return "crisis"
    if any(kw in lowered for kw in STRESS_KEYWORDS):
        return "stress"
    if any(kw in lowered for kw in POSITIVE_KEYWORDS):
        return "positive"
    return "neutral"


def matched_keywords(text: str, category: str):
    lowered = text.lower()
    bank = {
        "crisis": CRISIS_KEYWORDS,
        "stress": STRESS_KEYWORDS,
        "positive": POSITIVE_KEYWORDS,
    }.get(category, [])
    return [kw for kw in bank if kw in lowered]


def generate_reply(text: str):
    category = classify_message(text)

    if category == "crisis":
        return CRISIS_REPLY, True, category
    if category == "stress":
        return random.choice(STRESS_REPLIES), False, category
    if category == "positive":
        return random.choice(POSITIVE_REPLIES), False, category
    return random.choice(NEUTRAL_REPLIES), False, category


# ---------------------------------------------------------------------------
# Mood-based entertainment recommendations
# ---------------------------------------------------------------------------

RECOMMENDATIONS = {
    "Tangled": {
        "music": [
            {"title": "Weightless", "artist": "Marconi Union", "why": "A calm, spacious pick for a busy mind."},
            {"title": "Sunset Lover", "artist": "Petit Biscuit", "why": "Soft electronic energy without feeling too intense."},
            {"title": "Bloom", "artist": "The Paper Kites", "why": "Gentle acoustic atmosphere for slowing down."},
        ],
        "movies": [
            {"title": "Kiki's Delivery Service", "meta": "Warm · Animated", "why": "A comforting reset with a low-pressure feel."},
            {"title": "The Secret Life of Walter Mitty", "meta": "Adventure · Feel-good", "why": "A hopeful change-of-perspective watch."},
            {"title": "Paddington 2", "meta": "Comedy · Family", "why": "Kind, funny and easy to settle into."},
        ],
    },
    "Heavy": {
        "music": [
            {"title": "Vienna", "artist": "Billy Joel", "why": "A reflective reminder to slow the pace."},
            {"title": "Holocene", "artist": "Bon Iver", "why": "Quiet and atmospheric for a reflective evening."},
            {"title": "Here Comes the Sun", "artist": "The Beatles", "why": "A gentle lift when you want something brighter."},
        ],
        "movies": [
            {"title": "The Intern", "meta": "Comedy · Drama", "why": "Easygoing, warm and reassuring."},
            {"title": "Akeelah and the Bee", "meta": "Drama · Coming-of-age", "why": "A hopeful story about confidence and support."},
            {"title": "The Mitchells vs. the Machines", "meta": "Animated · Comedy", "why": "Fast, funny and family-centered."},
        ],
    },
    "Steady": {
        "music": [
            {"title": "Good Days", "artist": "SZA", "why": "A mellow soundtrack for an ordinary day."},
            {"title": "Sunday Best", "artist": "Surfaces", "why": "Light, sunny energy without being overwhelming."},
            {"title": "Put Your Records On", "artist": "Corinne Bailey Rae", "why": "Warm and easygoing for a relaxed mood."},
        ],
        "movies": [
            {"title": "The Truman Show", "meta": "Drama · Comedy", "why": "Thoughtful without being too heavy."},
            {"title": "Spider-Man: Into the Spider-Verse", "meta": "Animation · Action", "why": "Stylish, upbeat and very on-brand for SpideyTingle."},
            {"title": "School of Rock", "meta": "Comedy · Music", "why": "A fun, energetic comfort watch."},
        ],
    },
    "Bright": {
        "music": [
            {"title": "Walking on Sunshine", "artist": "Katrina and the Waves", "why": "Pure upbeat energy for a bright day."},
            {"title": "Levitating", "artist": "Dua Lipa", "why": "Dance-pop energy to keep the momentum going."},
            {"title": "Good as Hell", "artist": "Lizzo", "why": "Confident, celebratory energy."},
        ],
        "movies": [
            {"title": "Sing Street", "meta": "Music · Coming-of-age", "why": "Music, friendship and big feel-good energy."},
            {"title": "The Greatest Showman", "meta": "Musical · Drama", "why": "A colorful, high-energy watch."},
            {"title": "Free Guy", "meta": "Comedy · Action", "why": "Playful and upbeat with plenty of momentum."},
        ],
    },
    "Web-Slinging": {
        "music": [
            {"title": "Don't Stop Me Now", "artist": "Queen", "why": "Big, joyful momentum for a high-energy day."},
            {"title": "Adventure of a Lifetime", "artist": "Coldplay", "why": "Bright, driving energy for getting things done."},
            {"title": "On Top of the World", "artist": "Imagine Dragons", "why": "A celebratory soundtrack for a win."},
        ],
        "movies": [
            {"title": "Spider-Man: Across the Spider-Verse", "meta": "Animation · Action", "why": "Stylish, energetic and perfectly matched to the web theme."},
            {"title": "The Lego Movie", "meta": "Animation · Comedy", "why": "Fast, funny and relentlessly upbeat."},
            {"title": "How to Train Your Dragon", "meta": "Animation · Adventure", "why": "Big adventure energy with a warm heart."},
        ],
    },
}


def normalize_mood_label(mood):
    if not mood:
        return "Steady"
    value = str(mood).strip().lower()
    for label in RECOMMENDATIONS:
        if label.lower() == value:
            return label
    return "Steady"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/checkin", methods=["POST"])
def checkin():
    data = request.get_json(force=True) or {}
    mood_score = data.get("mood_score")
    mood_label = data.get("mood_label", "")
    tags = data.get("tags", [])
    note = data.get("note", "")

    if mood_score is None or not (1 <= int(mood_score) <= 5):
        return jsonify({"error": "mood_score must be an integer 1-5"}), 400
    if not isinstance(tags, list):
        tags = []

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO moods (mood_score, mood_label, tags, note, created_at) VALUES (?, ?, ?, ?, ?)",
        (mood_score, mood_label, json.dumps(tags), note, now),
    )
    db.commit()
    alert = maybe_create_support_alert()
    return jsonify({"status": "ok", "created_at": now, "support_alert": alert})


@app.route("/api/history", methods=["GET"])
def history():
    db = get_db()
    rows = db.execute(
        "SELECT mood_score, mood_label, tags, note, created_at FROM moods ORDER BY created_at ASC"
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["tags"] = json.loads(d["tags"] or "[]")
        except (TypeError, ValueError):
            d["tags"] = []
        out.append(d)
    return jsonify(out)


@app.route("/api/stats", methods=["GET"])
def stats():
    db = get_db()
    rows = db.execute(
        "SELECT mood_score, created_at FROM moods ORDER BY created_at ASC"
    ).fetchall()

    if not rows:
        return jsonify({"streak_days": 0, "avg_7": None, "today_logged": False})

    days = sorted({datetime.fromisoformat(r["created_at"]).date() for r in rows})
    today = datetime.now(timezone.utc).date()

    today_logged = days[-1] == today

    streak = 0
    cursor = today if today_logged else today - timedelta(days=1)
    day_set = set(days)
    while cursor in day_set:
        streak += 1
        cursor -= timedelta(days=1)

    last_scores = [r["mood_score"] for r in rows[-7:]]
    avg_7 = round(sum(last_scores) / len(last_scores), 1) if last_scores else None

    return jsonify({"streak_days": streak, "avg_7": avg_7, "today_logged": today_logged})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "message is required"}), 400

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO chats (sender, message, category, flagged, created_at) VALUES (?, ?, ?, ?, ?)",
        ("user", message, classify_message(message), 0, now),
    )

    reply, flagged, category = generate_reply(message)

    db.execute(
        "INSERT INTO chats (sender, message, category, flagged, created_at) VALUES (?, ?, ?, ?, ?)",
        ("spidey", reply, category, int(flagged), datetime.now(timezone.utc).isoformat()),
    )
    db.commit()

    return jsonify({
        "reply": reply,
        "flagged": flagged,
        "category": category,
        "sense": SENSE_COPY.get(category),
        "matched": matched_keywords(message, category),
        "nudge": NUDGES.get(category),
    })


@app.route("/api/recommendations", methods=["GET"])
def recommendations():
    mood = normalize_mood_label(request.args.get("mood"))
    return jsonify({"mood": mood, **RECOMMENDATIONS[mood]})


@app.route("/api/diary", methods=["GET"])
def diary_history():
    db = get_db()
    rows = db.execute(
        "SELECT id, title, entry, mood_label, mood_score, created_at FROM diary ORDER BY created_at DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/diary", methods=["POST"])
def save_diary():
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    entry = (data.get("entry") or "").strip()
    mood_label = (data.get("mood_label") or "").strip()
    mood_score = data.get("mood_score")

    if not entry:
        return jsonify({"error": "entry is required"}), 400
    if len(entry) > 5000:
        return jsonify({"error": "entry is too long"}), 400
    if mood_score is not None:
        try:
            mood_score = int(mood_score)
            if mood_score < 1 or mood_score > 5:
                mood_score = None
        except (TypeError, ValueError):
            mood_score = None

    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    cur = db.execute(
        "INSERT INTO diary (title, entry, mood_label, mood_score, created_at) VALUES (?, ?, ?, ?, ?)",
        (title, entry, mood_label, mood_score, now),
    )
    db.commit()
    return jsonify({"status": "ok", "id": cur.lastrowid, "created_at": now})


# ---------------------------------------------------------------------------
# Support circle, alerts + therapist-ready reports
# ---------------------------------------------------------------------------

def get_profile():
    db = get_db()
    row = db.execute("SELECT * FROM profile WHERE id = 1").fetchone()
    if not row:
        return {"id": 1, "user_name": "", "contacts": [], "alert_enabled": 0, "alert_threshold_days": 3}
    item = dict(row)
    try:
        item["contacts"] = json.loads(item.get("contacts") or "[]")
    except (TypeError, ValueError):
        item["contacts"] = []
    return item


def persistent_low_pattern(days=3):
    """Simple support-alert pattern; it is not a diagnosis."""
    db = get_db()
    rows = db.execute(
        "SELECT mood_score, created_at FROM moods ORDER BY created_at DESC LIMIT 12"
    ).fetchall()
    if len(rows) < days:
        return False, 0
    # Require one check-in on each of the last N calendar days and a low average.
    by_day = {}
    for row in rows:
        day = datetime.fromisoformat(row["created_at"]).date()
        by_day.setdefault(day, []).append(int(row["mood_score"]))
    today = datetime.now(timezone.utc).date()
    scores = []
    for offset in range(days):
        day = today - timedelta(days=offset)
        if day not in by_day:
            return False, 0
        scores.append(sum(by_day[day]) / len(by_day[day]))
    avg = sum(scores) / len(scores)
    return avg <= 2.0, round(avg, 1)


def send_support_alert(profile, reason, message):
    contacts = [c for c in profile.get("contacts", []) if c.get("email")]
    if not contacts:
        return False, "No contact email is configured."
    host = os.getenv("SPIDEY_SMTP_HOST")
    port = int(os.getenv("SPIDEY_SMTP_PORT", "587"))
    username = os.getenv("SPIDEY_SMTP_USERNAME")
    password = os.getenv("SPIDEY_SMTP_PASSWORD")
    sender = os.getenv("SPIDEY_ALERT_FROM", username or "")
    if not (host and username and password and sender):
        return False, "Alert saved as a preview. Configure SMTP environment variables to send real email alerts."
    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            for contact in contacts:
                msg = EmailMessage()
                msg["Subject"] = "SpideyTingle support check-in"
                msg["From"] = sender
                msg["To"] = contact["email"]
                msg.set_content(message)
                smtp.send_message(msg)
        return True, f"Alert emailed to {len(contacts)} trusted contact(s)."
    except Exception as exc:
        app.logger.warning("Support alert email failed: %s", exc)
        return False, "Alert was saved, but email delivery failed. Check the SMTP settings."


def maybe_create_support_alert():
    profile = get_profile()
    if not profile.get("alert_enabled"):
        return None
    triggered, avg = persistent_low_pattern(int(profile.get("alert_threshold_days") or 3))
    if not triggered:
        return None
    db = get_db()
    # Avoid repeatedly alerting for the same persistent pattern.
    recent = db.execute(
        "SELECT created_at FROM support_alerts ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    if recent:
        last = datetime.fromisoformat(recent["created_at"])
        if datetime.now(timezone.utc) - last < timedelta(days=2):
            return {"triggered": True, "already_sent": True, "average": avg}
    message = (
        f"SpideyTingle noticed a persistent low-mood/stress pattern in recent check-ins (average {avg}/5). "
        "This is not a diagnosis. Please check in with them, listen without judgement, and help them connect with a trusted adult or professional if needed."
    )
    contacts_json = json.dumps(profile.get("contacts", []))
    now = datetime.now(timezone.utc).isoformat()
    cur = db.execute(
        "INSERT INTO support_alerts (reason, severity, message, contacts, sent, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("persistent_low_mood_pattern", "support", message, contacts_json, 0, now),
    )
    db.commit()
    sent, status = send_support_alert(profile, "persistent_low_mood_pattern", message)
    if sent:
        db.execute("UPDATE support_alerts SET sent = 1 WHERE id = ?", (cur.lastrowid,))
        db.commit()
    return {"triggered": True, "already_sent": False, "average": avg, "message": message, "status": status, "sent": sent}


@app.route("/api/profile", methods=["GET", "POST"])
def profile_api():
    if request.method == "GET":
        return jsonify(get_profile())
    data = request.get_json(force=True) or {}
    contacts = data.get("contacts", [])
    if not isinstance(contacts, list):
        contacts = []
    clean = []
    for c in contacts[:5]:
        if not isinstance(c, dict):
            continue
        name = str(c.get("name", "")).strip()[:80]
        email = str(c.get("email", "")).strip()[:160]
        phone = str(c.get("phone", "")).strip()[:40]
        if name or email or phone:
            clean.append({"name": name, "email": email, "phone": phone})
    try:
        threshold = max(2, min(7, int(data.get("alert_threshold_days", 3))))
    except (TypeError, ValueError):
        threshold = 3
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO profile (id, user_name, contacts, alert_enabled, alert_threshold_days, updated_at) VALUES (1, ?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET user_name=excluded.user_name, contacts=excluded.contacts, alert_enabled=excluded.alert_enabled, alert_threshold_days=excluded.alert_threshold_days, updated_at=excluded.updated_at",
        (str(data.get("user_name", "")).strip()[:80], json.dumps(clean), int(bool(data.get("alert_enabled"))), threshold, now),
    )
    db.commit()
    return jsonify(get_profile())


@app.route("/api/support-status", methods=["GET"])
def support_status():
    profile = get_profile()
    triggered, avg = persistent_low_pattern(int(profile.get("alert_threshold_days") or 3))
    return jsonify({"enabled": bool(profile.get("alert_enabled")), "triggered": triggered, "average": avg, "threshold_days": profile.get("alert_threshold_days", 3)})


@app.route("/api/support-alert/test", methods=["POST"])
def test_support_alert():
    profile = get_profile()
    if not profile.get("alert_enabled"):
        return jsonify({"error": "Enable trusted-contact alerts in the profile first."}), 400
    message = (
        "SpideyTingle test alert: this is a test of your trusted-contact notification setup. "
        "No mental-health conclusion is being made by this test."
    )
    sent, status = send_support_alert(profile, "test", message)
    return jsonify({"sent": sent, "status": status, "message": message})


@app.route("/api/support-alerts", methods=["GET"])
def support_alert_history():
    db = get_db()
    rows = db.execute("SELECT id, reason, severity, message, sent, created_at FROM support_alerts ORDER BY created_at DESC LIMIT 20").fetchall()
    return jsonify([dict(r) for r in rows])


def build_therapist_report():
    db = get_db()
    moods = db.execute("SELECT mood_score, mood_label, tags, note, created_at FROM moods ORDER BY created_at ASC").fetchall()
    analyses = db.execute("SELECT predicted_label, signal_score, voice_pace, voice_energy, voice_pitch, voice_pauses, typing_wpm, typing_pauses, typing_backspaces, created_at FROM mood_analyses ORDER BY created_at ASC").fetchall()
    diaries = db.execute("SELECT title, entry, mood_label, mood_score, created_at FROM diary ORDER BY created_at ASC").fetchall()
    chats = db.execute("SELECT category, flagged, created_at FROM chats WHERE sender='user' ORDER BY created_at ASC").fetchall()
    tags = {}
    scores = []
    for row in moods:
        scores.append(int(row["mood_score"]))
        try:
            row_tags = json.loads(row["tags"] or "[]")
        except (TypeError, ValueError):
            row_tags = []
        for tag in row_tags:
            tags[tag] = tags.get(tag, 0) + 1
    avg = round(sum(scores) / len(scores), 2) if scores else None
    last7 = scores[-7:]
    avg7 = round(sum(last7) / len(last7), 2) if last7 else None
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Reflection report for discussion with a qualified therapist or counselor. It is not a diagnosis.",
        "check_ins": len(moods),
        "average_mood_1_to_5": avg,
        "last_7_average_1_to_5": avg7,
        "lowest_recent_score": min(scores[-7:]) if scores else None,
        "highest_recent_score": max(scores[-7:]) if scores else None,
        "common_context_tags": sorted(tags.items(), key=lambda x: x[1], reverse=True)[:8],
        "diary_entries": len(diaries),
        "voice_typing_analyses": len(analyses),
        "chat_stress_or_support_signals": sum(1 for r in chats if r["category"] in ("stress", "crisis")),
        "support_alerts": db.execute("SELECT COUNT(*) AS c FROM support_alerts").fetchone()["c"],
        "recent_check_ins": [dict(r) for r in moods[-10:]],
        "recent_diary": [dict(r) for r in diaries[-5:]],
        "recent_signal_analyses": [dict(r) for r in analyses[-5:]],
        "discussion_prompts": [
            "Which situations or routines seem to coincide with lower mood scores?",
            "What coping strategies or supports appear to help?",
            "Are there changes in sleep, workload, relationships, or daily routine worth discussing?",
            "What would the user like to work on before the next session?"
        ],
    }
    return report


@app.route("/api/therapist-report", methods=["GET"])
def therapist_report():
    return jsonify(build_therapist_report())


# ---------------------------------------------------------------------------
# Future Self letters + goals
# ---------------------------------------------------------------------------

def low_mood_pattern():
    """Return True for a simple recent check-in pattern, not a diagnosis."""
    db = get_db()
    rows = db.execute(
        "SELECT mood_score FROM moods ORDER BY created_at DESC LIMIT 4"
    ).fetchall()
    scores = [int(r["mood_score"]) for r in rows]
    if len(scores) >= 3 and sum(scores[:3]) / 3 <= 2.0:
        return True
    if len(scores) >= 2 and all(score <= 2 for score in scores[:2]):
        return True
    return False


@app.route("/api/future-letters", methods=["GET"])
def future_letters():
    db = get_db()
    today = datetime.now(timezone.utc).date().isoformat()
    low_pattern = low_mood_pattern()
    rows = db.execute(
        "SELECT id, title, entry, trigger_type, target_date, opened, created_at FROM future_letters ORDER BY created_at DESC"
    ).fetchall()

    result = []
    for row in rows:
        item = dict(row)
        due = (
            (item["trigger_type"] == "date" and item["target_date"] and item["target_date"] <= today)
            or (item["trigger_type"] == "low_mood" and low_pattern)
        )
        item["available"] = bool(due)
        result.append(item)

    return jsonify({"low_mood_pattern": low_pattern, "letters": result})


@app.route("/api/future-letters", methods=["POST"])
def save_future_letter():
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    entry = (data.get("entry") or "").strip()
    trigger_type = (data.get("trigger_type") or "low_mood").strip()
    target_date = (data.get("target_date") or "").strip()

    if not entry:
        return jsonify({"error": "letter is required"}), 400
    if len(entry) > 4000:
        return jsonify({"error": "letter is too long"}), 400
    if trigger_type not in {"low_mood", "date"}:
        trigger_type = "low_mood"
    if trigger_type == "date" and not target_date:
        return jsonify({"error": "a date is required for date delivery"}), 400

    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    cur = db.execute(
        "INSERT INTO future_letters (title, entry, trigger_type, target_date, created_at) VALUES (?, ?, ?, ?, ?)",
        (title, entry, trigger_type, target_date, now),
    )
    db.commit()
    return jsonify({"status": "ok", "id": cur.lastrowid, "created_at": now})


@app.route("/api/mood-analysis", methods=["POST"])
def save_mood_analysis():
    """Store derived voice/typing metrics only; raw audio and keystrokes are never stored."""
    data = request.get_json(force=True) or {}
    label = (data.get("predicted_label") or "Steady signal").strip()[:60]
    try:
        score = max(0, min(100, int(data.get("signal_score", 50))))
    except (TypeError, ValueError):
        score = 50

    def num(key, default=None):
        try:
            value = data.get(key, default)
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return default

    def integer(key, default=0):
        try:
            return int(data.get(key, default))
        except (TypeError, ValueError):
            return default

    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    cur = db.execute(
        """INSERT INTO mood_analyses
        (predicted_label, signal_score, voice_pace, voice_energy, voice_pitch, voice_pauses, typing_wpm, typing_pauses, typing_backspaces, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (label, score, num("voice_pace"), num("voice_energy"), num("voice_pitch"),
         integer("voice_pauses"), num("typing_wpm"), integer("typing_pauses"),
         integer("typing_backspaces"), now),
    )
    db.commit()
    return jsonify({"status": "ok", "id": cur.lastrowid, "created_at": now})


@app.route("/api/mood-analysis/latest", methods=["GET"])
def latest_mood_analysis():
    db = get_db()
    row = db.execute("SELECT * FROM mood_analyses ORDER BY created_at DESC LIMIT 1").fetchone()
    return jsonify(dict(row) if row else {})


@app.route("/api/goals", methods=["GET"])
def goals_history():
    db = get_db()
    rows = db.execute(
        "SELECT id, goal, completed, created_at, completed_at FROM goals ORDER BY completed ASC, created_at DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/goals", methods=["POST"])
def add_goal():
    data = request.get_json(force=True) or {}
    goal = (data.get("goal") or "").strip()
    if not goal:
        return jsonify({"error": "goal is required"}), 400
    if len(goal) > 160:
        return jsonify({"error": "goal is too long"}), 400
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    cur = db.execute(
        "INSERT INTO goals (goal, created_at) VALUES (?, ?)",
        (goal, now),
    )
    db.commit()
    return jsonify({"status": "ok", "id": cur.lastrowid})


@app.route("/api/goals/<int:goal_id>/toggle", methods=["POST"])
def toggle_goal(goal_id):
    db = get_db()
    row = db.execute("SELECT completed FROM goals WHERE id = ?", (goal_id,)).fetchone()
    if row is None:
        return jsonify({"error": "goal not found"}), 404
    completed = 0 if row["completed"] else 1
    completed_at = datetime.now(timezone.utc).isoformat() if completed else None
    db.execute(
        "UPDATE goals SET completed = ?, completed_at = ? WHERE id = ?",
        (completed, completed_at, goal_id),
    )
    db.commit()
    return jsonify({"status": "ok", "completed": completed})


@app.route("/api/chat/history", methods=["GET"])
def chat_history():
    db = get_db()
    rows = db.execute(
        "SELECT sender, message, category, flagged, created_at FROM chats ORDER BY created_at ASC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


if __name__ == "__main__":
    init_db()
    app.run(host='0.0.0.0', port=5006, debug=True)
