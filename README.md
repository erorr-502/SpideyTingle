# SpideyTingle

**SpideyTingle** is a comic-inspired emotional self-awareness and reflection web app designed to make everyday emotional check-ins simple, engaging, and approachable.

Instead of treating a mood check-in as a one-time action, SpideyTingle creates a continuous reflection loop:

> **Check in → Vent → Sense → Nudge → Learn**

The application combines mood tracking, reflective conversation, personalized insights, journaling, goals, future-self exercises, safety resources, and an experimental emotional-signal lab inside a playful Spider-Man-inspired visual language.

SpideyTingle is a **wellness and self-reflection tool, not a medical device, therapist, diagnostic system, or replacement for professional care.**

---

## 1. What problem does SpideyTingle solve?

People often know that they are having a difficult day without knowing exactly what they are feeling, what may be influencing it, or what small action could help.

Traditional mood trackers often stop at:

> “How do you feel today?”

SpideyTingle goes further. It helps a user:

1. **Name a feeling**
2. **Add context**
3. **Write or talk about what is happening**
4. **Reflect on emotional signals**
5. **Receive a small next-step suggestion**
6. **Track changes over time**
7. **Discover personal patterns**
8. **Build a longer-term record of self-awareness**

The goal is to turn emotional awareness into a habit rather than a single check-in.

---

# 2. Core user journey

## The Tingle — Mood Check-In

The first step is a quick mood check-in.

Users can choose from five simple mood states:

- **Tangled**
- **Heavy**
- **Steady**
- **Bright**
- **Electric**

Each mood maps to a 1–5 score and can be combined with context tags and an optional note.

The check-in is saved to the local SQLite database and becomes part of the user's personal mood history.

### Why it matters

A short, low-friction check-in gives the rest of the application a starting point for reflection.

---

## The Vent — Companion Conversation

The Vent lets users write freely about what is on their mind.

The current implementation uses a lightweight **rule-based companion**, rather than a live external LLM. It detects broad categories such as:

- stress/anxiety
- positive feelings
- neutral conversation
- crisis-related language

The companion responds with supportive prompts and can suggest grounding or breathing exercises.

Chat messages are stored in the database so the experience can contribute to the user's broader reflection history.

### Important positioning

The companion is intentionally framed as a supportive reflection interface. It should not be presented as a therapist, doctor, or clinical mental-health assessment.

---

## The Sense — Emotional Reflection

After a conversation, SpideyTingle reflects back a broad emotional signal.

The Sense helps translate a user's words into a simple reflection such as:

- what emotional category may be present
- what the companion picked up
- what the user might want to consider next

The purpose is **reflection, not diagnosis**.

---

## The Nudge — Small Next Step

The Nudge turns reflection into action.

Rather than overwhelming the user with a long list of recommendations, SpideyTingle focuses on small, practical actions such as:

- breathing
- grounding
- taking a short pause
- talking to someone
- reflecting through writing

The application also contains recommendation logic that can adapt suggestions to the selected mood.

---

## The Insight — Mood Trends

The Insight section visualizes mood history.

Users can see how their check-in scores have changed and use the history to notice broad trends.

This is intended to answer questions such as:

- “Has my mood been improving?”
- “Have I been having more difficult days recently?”
- “What does my recent emotional pattern look like?”

The chart is based on the user's own recorded check-ins.

---

## The Loop — Check-In History

The Loop provides a chronological view of previous check-ins.

A stored check-in includes:

- mood score
- mood label
- context tags
- optional note
- timestamp

This creates a simple personal emotional timeline.

---

# 3. Spidey Intelligence

One of the main differentiators of the project is the **Spidey Intelligence** layer.

It uses the user's own history to generate broad, explainable reflections.

## Emotional Fingerprint

The Emotional Fingerprint summarizes recent signals into dimensions such as:

- energy
- stress
- social signal
- momentum

These values are derived from recent personal check-ins and are presented as a visual snapshot.

They are not clinical measurements.

---

## Emotional Weather

Emotional Weather provides a short-range reflection of the user's recent mood direction.

It considers recent check-ins and recurring context tags to describe whether the current pattern looks more positive, neutral, or difficult.

The interface also displays contributing context factors.

The intention is to make the analysis explainable rather than presenting an unexplained AI score.

---

## Pattern Explorer

Pattern Explorer groups context tags from previous check-ins and compares them with the associated average mood score.

For example, the application can show that check-ins tagged with a particular context had a certain average score.

### Important interpretation rule

These relationships are **correlations, not causes**.

If a tag appears alongside lower moods, the application must not claim that the tag caused the mood change.

---

## Reverse Journaling

Reverse Journaling turns the user's existing history into a readable reflection.

It can use:

- recent mood scores
- mood direction
- recurring context tags
- recent diary information

The feature helps users see their own history as a story rather than as a collection of disconnected numbers.

---

# 4. 2-Minute Spidey Reset

SpideyTingle includes an interactive two-minute reset experience.

The reset is structured as a short sequence of grounding/reflection steps.

The interface provides:

- a countdown timer
- step progression
- visual feedback
- a simple start/close interaction

The aim is to give users a lightweight reset they can complete without leaving the app.

---

# 5. Diary

The Diary gives users a dedicated space for longer-form reflection.

Diary entries can include:

- title
- written entry
- associated mood
- mood score
- timestamp

Diary content can also contribute to broader reflection features such as Reverse Journaling and the Therapist Toolkit report.

The Diary is intentionally separate from the quick mood check-in so users can choose between a fast entry and deeper writing.

---

# 6. Future Self

Future Self lets users write letters or reflections intended for their future selves.

Stored information includes:

- title
- entry
- trigger type
- target date
- opened state
- timestamp

This feature encourages longer-term reflection and creates a way for users to connect today's emotional state with future goals and intentions.

---

# 7. Goals

The Goals feature lets users create simple personal goals.

Goals can be:

- created
- displayed
- marked complete
- tracked with completion timestamps

This connects emotional reflection with small, practical behavior change.

---

# 8. Recommendations

SpideyTingle includes a recommendation area that can respond to the user's selected mood.

Recommendations can point users toward supportive activities such as:

- music
- movies
- reflection
- breathing
- journaling
- small wellness actions

The recommendation layer is designed to make the next step feel approachable rather than prescriptive.

---

# 9. Signal Lab

The project also contains an experimental **Voice/Typing Signal Lab**.

It explores broad signals that could potentially contribute to emotional reflection, including:

### Voice

- speaking pace
- energy
- pitch
- pauses

### Typing

- words per minute
- pauses
- backspaces

The current implementation stores derived signal values rather than raw voice recordings or raw keystrokes.

These features are experimental prototypes and should not be interpreted as reliable emotion detection.

---

# 10. Safety Net

Safety is a core part of the application.

The chat layer checks for crisis-related phrases such as references to:

- suicide
- wanting to die
- self-harm
- ending one's life
- feeling unable to continue

When crisis language is detected, the application can flag the conversation and move the user toward the Safety section.

The current safety response provides crisis-support guidance and encourages contacting appropriate immediate human support.

### Safety principle

SpideyTingle is designed to recognize when a situation may require support beyond an app.

It should never claim that its AI can safely manage a crisis on its own.

---

# 11. Trusted Circle / Support Alerts

The application includes a profile and support-contact system.

Users can configure:

- a display name
- trusted contacts
- alert preferences
- an alert threshold

The backend also tracks support-alert events.

This provides a foundation for a future trusted-person escalation workflow.

Email sending functionality is included in the backend architecture, but should be configured carefully before being used in a real deployment.

---

# 12. Therapist Toolkit

The Therapist Toolkit can generate a structured report from the user's stored information.

The report can summarize:

- recent check-ins
- mood scores
- context tags
- diary entries
- recurring patterns

The goal is to make a user's own reflection history easier to review with a trusted professional.

It should not be presented as a professional diagnosis or clinical report.

---

# 13. Emotional Weather Map

The project contains an opt-in prototype for an **Emotional Weather Map**.

The concept is to show an aggregated community-level emotional pulse rather than exposing individual users' moods.

The intended model is:

> **Individual data → anonymized aggregation → community-level pattern**

Individual moods should never be displayed publicly.

The current interface is a prototype for this concept and should undergo proper privacy review before any production deployment.

---

# 14. Physical Spidey Sense

The project also includes a UI prototype for a possible physical companion device.

The proposed architecture uses an:

**ESP32 + physical button + LED**

A possible future flow is:

1. User taps the physical device.
2. Device signals a check-in.
3. SpideyTingle receives the signal.
4. The application opens a quick reflection.
5. The LED/device returns to a ready state.

The current feature is a front-end demonstration of this concept rather than a complete hardware integration.

---

# 15. User Interface

The interface uses a **comic-inspired visual system** to make emotional reflection feel less clinical.

Key visual elements include:

- bold typography
- thick borders
- comic-style cards
- playful labels
- dotted textures
- bright accent colors
- SpideyTingle branding
- responsive dashboard layouts
- light/dark visual modes

The goal is to create an environment that feels approachable and expressive rather than like a traditional medical dashboard.

---

# 16. React + Flask architecture

The application uses a hybrid frontend architecture.

### Flask

Flask provides:

- application serving
- API endpoints
- SQLite persistence
- backend feature logic
- safety logic
- report generation

Main backend file:

```text
app.py
```

### React

React powers the redesigned application shell.

Main React files:

```text
static/react-ui/main.js
static/react-ui/styles.css
```

React is responsible for the modern dashboard shell, including:

- navigation
- dashboard header
- statistics
- theme controls
- application workspace
- navigation between feature areas

### Legacy feature layer

The existing feature panels and interaction logic remain available through:

```text
static/react-ui/legacy-content.html
static/script.js
```

This hybrid approach allowed the UI to be redesigned without discarding the existing Flask-backed feature functionality.

---

# 17. Backend API

The Flask application exposes the following main endpoints.

| Endpoint | Purpose |
|---|---|
| `GET /` | Serves the application |
| `POST /api/checkin` | Saves a mood check-in |
| `GET /api/history` | Retrieves mood history |
| `GET /api/stats` | Retrieves streak/average/today statistics |
| `POST /api/chat` | Sends a message to the companion |
| `GET /api/chat/history` | Retrieves chat history |
| `GET /api/recommendations` | Retrieves recommendations |
| `GET /api/diary` | Retrieves diary entries |
| `POST /api/diary` | Creates a diary entry |
| `GET /api/future-letters` | Retrieves Future Self letters |
| `POST /api/future-letters` | Creates a Future Self letter |
| `POST /api/mood-analysis` | Stores mood-signal analysis |
| `GET /api/mood-analysis/latest` | Retrieves latest signal analysis |
| `GET /api/goals` | Retrieves goals |
| `POST /api/goals` | Creates a goal |
| `POST /api/goals/<id>/toggle` | Toggles goal completion |
| `GET /api/profile` | Retrieves profile/support settings |
| `POST /api/profile` | Updates profile/support settings |
| `GET /api/support-status` | Retrieves support configuration status |
| `POST /api/support-alert/test` | Tests the support-alert workflow |
| `GET /api/support-alerts` | Retrieves support-alert records |
| `GET /api/therapist-report` | Generates the reflection report |

---

# 18. Database

The project uses **SQLite** for local persistence.

Database file:

```text
spideytingle.db
```

Main tables include:

- `moods`
- `chats`
- `diary`
- `future_letters`
- `mood_analyses`
- `goals`
- `profile`
- `support_alerts`

The database is initialized automatically by the Flask application.

For a production system, authentication, authorization, encryption, backups, retention policies, and a stronger database architecture would be required.

---

# 19. Project structure

```text
spideytingle/
│
├── app.py
├── spideytingle.db
├── requirements.txt
├── README.md
│
├── templates/
│   └── index.html
│
└── static/
    ├── script.js
    ├── style.css
    │
    ├── react-ui/
    │   ├── main.js
    │   ├── styles.css
    │   └── legacy-content.html
    │
    └── assets/
        ├── spidey-comic-watermark.jpg
        ├── spideytingle-logo-source.png
        └── spideytingle-logo.png
```

---

# 20. Running the project locally

## Requirements

- Python 3
- pip
- a modern web browser

## Setup

Create a virtual environment:

```bash
python3 -m venv .venv
```

Activate it:

### macOS / Linux

```bash
source .venv/bin/activate
```

### Windows

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the application:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

---

# 21. Recommended demo flow

For a presentation or hackathon demo, the following sequence shows the app particularly well:

### Step 1 — Check in

Choose different moods such as:

- Tangled
- Heavy
- Steady
- Bright
- Electric

Add context tags and a short note.

### Step 2 — Vent

Open the companion and write about how the day is going.

### Step 3 — Sense

Show how the application reflects the broad emotional category detected from the conversation.

### Step 4 — Nudge

Demonstrate the suggested next action or breathing/reset activity.

### Step 5 — Build history

Create two or three check-ins with different moods and context tags.

### Step 6 — Spidey Intelligence

Show:

- Emotional Fingerprint
- Emotional Weather
- Pattern Explorer
- Reverse Journaling

### Step 7 — Diary

Create a diary entry and show how reflection can build over time.

### Step 8 — Future Self / Goals

Create a future letter or personal goal.

### Step 9 — Safety

Briefly explain the Safety Net and crisis-language detection.

### Step 10 — Future vision

Show the Emotional Weather Map and Physical Spidey Sense prototypes as examples of how the platform could expand.

---

# 22. Privacy and responsible-AI principles

SpideyTingle is designed around several important principles:

### Personal-first analysis

Insights are primarily based on the user's own history rather than comparisons against other individuals.

### Explainability

Where possible, the interface shows the signals or context that contributed to an insight.

### No diagnosis

Mood scores, emotional signals, and pattern summaries are not medical diagnoses.

### User control

Future production versions should provide clear controls for:

- data storage
- deletion
- sharing
- community participation
- trusted contacts
- integrations

### Community aggregation

The Emotional Weather Map is intended to show aggregated patterns, not individual emotional states.

### Safety escalation

When crisis-related language appears, the app should direct the user toward real human support rather than pretending the application can replace it.

---

# 23. Current limitations

This repository is a prototype/hackathon-oriented build.

Important limitations include:

- The companion is currently rule-based rather than a production LLM.
- Emotional signal analysis is experimental.
- The Physical Spidey Sense is a UI prototype rather than a finished hardware product.
- The Emotional Weather Map is a prototype concept.
- Authentication and multi-user account isolation are not implemented as a production identity system.
- Production privacy/security controls would need substantial additional work.
- Recommendations should be treated as general wellness suggestions, not medical advice.
- Safety detection based on keywords can produce false positives and false negatives.

---

# 24. Future scope

SpideyTingle can evolve in several directions.

## Smarter personalization

AI could learn recurring patterns from a user's own history and provide more relevant reflections and suggestions.

## Long-term emotional pattern detection

The platform could identify changes across weeks or months and help users recognize recurring cycles.

## Daily-routine integrations

With explicit user permission, integrations could include:

- calendars
- sleep data
- fitness data
- wearable devices
- activity patterns

This could help users explore how everyday routines relate to their mood.

## More conversational reflection

A future AI companion could support:

- guided journaling
- deeper reflection
- personalized prompts
- structured check-ins
- adaptive breathing exercises

## Student-focused wellness

A dedicated experience could help users reflect on:

- academic pressure
- deadlines
- study habits
- social pressure
- work-life balance

## Physical companion

The ESP32 concept could become a real one-tap physical check-in device.

## Privacy-preserving community insights

The Emotional Weather Map could evolve into a carefully designed anonymous aggregate system with strong privacy guarantees.

## Professional collaboration

The Therapist Toolkit could become a controlled, consent-based way to share selected reflections with a professional.

---

# 25. Product vision

The long-term vision is for SpideyTingle to become more than a mood tracker.

It can become a daily emotional-awareness companion that helps people:

> **Notice → Express → Understand → Act → Reflect**

The core idea is simple:

**When you understand what you are feeling, you have a better starting point for understanding what you need.**

---

## Final tagline

> **SpideyTingle — catch your feelings before they catch you.** 🕷️

**Check in. Tune in. Grow.**
