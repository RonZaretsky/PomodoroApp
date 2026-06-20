# Pomodoro App

A macOS menu bar Pomodoro timer built with Electron. Sits quietly in your menu bar, shows a live progress ring as the icon, and sends native notifications when sessions end.

## Features

- **Menu bar icon** — animated progress ring that depletes as the timer counts down
- **Three session modes** — Focus, Short Break, Long Break with automatic sequencing
- **Custom schedule** — build any sequence of Study/Break steps with your own durations
- **Auto-advance** — optionally start the next session automatically
- **Native notifications** — macOS notification when each session ends
- **Ding sound** — configurable 1–10 dings on completion
- **Persistent settings** — all preferences saved locally

## Download (no Node.js needed)

Go to the [Releases page](https://github.com/RonZaretsky/PomodoroApp/releases/latest) and download the right DMG for your Mac:

| Mac | File |
|---|---|
| Apple Silicon (M1/M2/M3/M4) | `Pomodoro-1.0.0-Apple-Silicon.dmg` |
| Intel | `Pomodoro-1.0.0-Intel.dmg` |

1. Open the DMG and drag **Pomodoro** into your Applications folder
2. Launch it from Applications — the icon appears in your menu bar

> **"App can't be opened" warning?** Right-click the app → **Open** → **Open**. You only need to do this once. This happens because the app is unsigned (no Apple Developer certificate).

---

## Build from source

## Requirements

- macOS 11 or later
- Node.js v18 or later (includes npm)

## Installation on a new Mac

### Step 1 — Install Node.js (if you don't have it)

**Option A — Official installer (easiest):**
1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button)
3. Open the downloaded `.pkg` file and follow the installer
4. When it finishes, open **Terminal** and verify it worked:
   ```bash
   node --version   # should print v18.x.x or higher
   npm --version    # should print a version number
   ```

**Option B — Homebrew (if you already use it):**
```bash
brew install node
```

> Don't have Homebrew either? Install it first:
> ```bash
> /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
> ```

---

### Step 2 — Clone and run the app

```bash
# 1. Clone the repo
git clone https://github.com/RonZaretsky/PomodoroApp.git
cd PomodoroApp

# 2. Install dependencies
npm install

# 3. Run
npm start
```

The app icon will appear in your menu bar. Click it to open the timer.

## First-time macOS notification setup

Electron apps need explicit permission to send notifications:

1. Open **System Settings → Notifications**
2. Find **Electron** in the list
3. Enable **Allow notifications**

## How to use

### Basic timer

1. Click the menu bar icon to open the timer
2. Choose a session type from the tabs: **Focus**, **Short Break**, or **Long Break**
3. Press ▶ to start — the menu bar icon will show the progress as the arc depletes
4. When time is up you'll hear a ding and receive a notification
5. Press ▶ again to start the next session

### Custom schedule

1. Click the **list icon** (bottom-left of the timer) to open the Schedule page
2. Each step has a **Study/Break** type toggle and a duration in minutes
3. Use **−** / **+** to adjust minutes (hold for fast scroll), or type directly
4. Click **+ Add step** to append a new step (alternates Study/Break automatically)
5. Toggle **Auto-advance** if you want steps to start without tapping play
6. Press **Start ▶** — the timer switches to schedule mode showing "Step N of M"
7. Click **← Exit** to return to standard mode at any time

### Settings

Click the **gear icon** (bottom-right) to adjust:

| Setting | Default | Description |
|---|---|---|
| Focus duration | 25 min | Length of a focus session |
| Short break | 5 min | Short break after each focus block |
| Long break | 15 min | Longer break after completing all rounds |
| Rounds until long break | 4 | Focus sessions before a long break |
| Notifications | On | Native macOS notification on session end |
| Sound on complete | On | Play a ding sound when session ends |
| Ding count | 3 | How many dings to play (1–10, 0.5 s apart) |

### Quitting

Right-click the menu bar icon → **Quit Pomodoro**.

## Project structure

```
PomodoroApp/
├── main.js          # Electron main process — tray, window, IPC, icon rendering
├── preload.js       # Secure bridge between main and renderer
├── package.json
└── renderer/
    ├── index.html   # UI structure
    ├── styles.css   # Dark theme, layout
    └── renderer.js  # Timer logic, schedule engine, settings persistence
```
