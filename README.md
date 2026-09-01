# SpideyTingle — Hackathon Build

SpideyTingle is a privacy-first emotional self-awareness companion. It is a supportive reflection tool, not a therapist or diagnostic system.

## Core journey
- The Tingle — 1–5 mood check-in with context tags
- The Vent — supportive companion chat
- The Sense — broad emotional signal reflection
- The Nudge — small next actions + breathing
- The Insight — mood trend chart
- The Loop — check-in history
- Safety Net — safety/support information

## Hackathon differentiators
- **Spidey Intelligence / Emotional Fingerprint** — compares recent signals against the user's own baseline.
- **Emotional Weather** — a short-range pattern reflection with explainable context factors.
- **Pattern Explorer** — shows context tags and their associated average check-in score as correlations, not causes.
- **Reverse Journaling** — turns the user's own history into a readable reflection.
- **2-Minute Spidey Reset** — interactive four-step grounding/reset flow.
- **Emotional Weather Map** — opt-in anonymized community pulse prototype; individual moods are never displayed.
- **Physical Spidey Sense demo** — UI prototype for an ESP32 + button + LED companion.
- Existing **Diary, Future Self, Goals, Voice/Typing signal lab, Trusted Circle, Therapist Toolkit, Music/Movie recommendations** remain intact.

## Run locally
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Then open `http://127.0.0.1:5000`.

## Hackathon demo path
1. Make 2–3 check-ins with different moods/tags.
2. Open **Spidey Intelligence** and click **Refresh My Spidey Sense**.
3. Show the Emotional Fingerprint and Pattern Explorer.
4. Open **Reverse Journaling** and generate the reflection.
5. Run the **2-Minute Spidey Reset** demo.
6. Toggle the **Emotional Weather Map** opt-in.
7. Run the **Physical Spidey Sense** device demo and explain the ESP32 architecture.

## Privacy/safety positioning
The intelligence layer uses broad, explainable personal patterns. It should not be presented as clinical prediction or diagnosis. Voice audio and raw keystrokes are not stored by the existing signal lab. Community pulse participation is opt-in and intended to be aggregated.

## React UI redesign
The frontend has been redesigned as a React-powered shell while retaining the existing Flask API and feature logic. React owns the responsive navigation, dashboard header, stats, theme toggle, and application shell; the existing feature panels are mounted into the React workspace so the current API-backed interactions remain intact.

Run exactly as before:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
The redesigned UI is served from the same Flask app at `http://127.0.0.1:5000`.
