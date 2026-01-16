# 🏋️ IronAI Fitness — Offline-First Gym Tracker (PWA)

IronAI Fitness is a mobile-first, offline-ready Progressive Web App (PWA)
designed to track workouts, exercises, and fitness progress — without login,
backend, or internet dependency.

All data stays 100% on the user’s device, making it fast, private, and reliable.

---

## 🚀 Key Features

- No login / No signup
- No backend / No cloud
- Offline-first (PWA)
- Local device storage only
- Privacy-friendly
- Fast & lightweight
- Mobile-first UI
- Desktop + mobile navigation

---

## 🧠 Core Functionalities

### 🏋️ Workout Tracking
- Start & finish workouts with live timer
- Workout splits:
  - Bro Split
  - Push / Pull / Legs
  - Upper / Lower
  - Full Body
- Add, remove, and customize exercises
- Track sets, reps, and weights
- Automatic rest timer after each set

### 📈 Progress & Gamification
- XP & Level system
- Personal Record (PR) detection
- Workout streak tracking
- Weekly consistency chart
- Detailed workout history

### 🧮 Fitness Tools
- 1RM Calculator
- BMI & Calorie Estimator
- Plate Calculator
- Offline AI Coach (basic nutrition guidance)

### 🖼️ Fitness Timeline
- Upload progress photos
- Add notes
- Track body transformation over time

### 💾 Backup & Restore
- Export all data as JSON
- Import local backup
- Reset all data (device-only)

---

## 🛠 Tech Stack

Frontend:
- HTML
- CSS (Dark Theme, CSS Variables)
- Vanilla JavaScript

Storage:
- IndexedDB (primary)
- LocalStorage (small settings only)

Charts:
- Chart.js (bundled locally, no CDN)

PWA:
- manifest.json
- service-worker.js
- Offline caching (stale-while-revalidate)
- Installable on mobile & desktop

---

## 📂 Project Structure

ironai-fitness/
├── index.html          # Main UI
├── styles.css          # Dark theme & responsive styles
├── script.js           # App logic & IndexedDB
├── service-worker.js   # Offline caching
├── manifest.json       # PWA metadata
└── assets/
    ├── chart.min.js
    ├── icon-any.svg
    ├── icon-maskable.svg
    └── ironai.woff2

---

## ⚙️ How to Run Locally

1. Download or clone the project
2. Open index.html in a browser

OR (recommended for PWA testing):

npx serve .

3. Open in Chrome
4. Install App
5. Use fully offline

---

## 📱 PWA Installation

- Open in Chrome / Edge
- Click “Install App”
- Works completely offline
- Data remains only on your device

---

## 🔐 Privacy Policy

- No accounts
- No tracking
- No analytics
- No cloud sync
- 100% local IndexedDB storage
- User controls all data

---

## 🎯 Ideal Use Cases

- Personal gym tracking
- Hostel / college students
- Offline gyms
- Privacy-focused users
- Fitness portfolio project

---

## 🧪 Project Status

Version: v1 (Stable MVP)

Future Enhancements:
- CSV export
- Progressive overload suggestions
- Theme customization
- Multi-profile (local)

---

## 📄 License

Open for learning, personal use, and portfolio purposes.

---

## 💡 Author

Built with discipline and consistency 💪  
IronAI Fitness

