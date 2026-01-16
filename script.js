
"use strict";

const DB_NAME = "ironai";
const DB_VERSION = 1;
const STORES = {
  SETTINGS: "settings",
  PROFILE: "profile",
  EXERCISES: "exercises",
  PLANS: "plans",
  WORKOUTS: "workouts",
  TIMELINE: "timeline",
};

const APP_CACHE_VERSION = "ironai-v1";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_REST = 90;

const defaultExerciseLibrary = [
  "Bench Press",
  "Incline DB Press",
  "Cable Fly",
  "Deadlift",
  "Barbell Row",
  "Lat Pulldown",
  "Overhead Press",
  "Lateral Raise",
  "Rear Delt Fly",
  "Barbell Curl",
  "Hammer Curl",
  "Tricep Pushdown",
  "Squat",
  "Leg Press",
  "Calf Raise",
  "Plank",
  "Hanging Leg Raise",
  "Cable Crunch",
  "Pull-up",
  "Seated Row",
  "Face Pull",
  "Romanian Deadlift",
  "Split Squat",
  "Hamstring Curl",
  "Dips",
  "Incline Press",
];

const splitTemplates = {
  "Bro Split": {
    Mon: ["Bench Press", "Incline DB Press", "Cable Fly"],
    Tue: ["Deadlift", "Barbell Row", "Lat Pulldown"],
    Wed: ["Overhead Press", "Lateral Raise", "Rear Delt Fly"],
    Thu: ["Barbell Curl", "Tricep Pushdown", "Hammer Curl"],
    Fri: ["Squat", "Leg Press", "Calf Raise"],
    Sat: ["Plank", "Hanging Leg Raise", "Cable Crunch"],
    Sun: [],
  },
  "Push / Pull / Legs": {
    Mon: ["Bench Press", "Overhead Press", "Tricep Pushdown"],
    Tue: ["Deadlift", "Pull-up", "Barbell Row"],
    Wed: ["Squat", "Hamstring Curl", "Calf Raise"],
    Thu: ["Incline Press", "Dips", "Lateral Raise"],
    Fri: ["Lat Pulldown", "Seated Row", "Face Pull"],
    Sat: ["Leg Press", "Split Squat", "Calf Raise"],
    Sun: [],
  },
  "Upper / Lower": {
    Mon: ["Bench Press", "Barbell Row", "Overhead Press"],
    Tue: ["Squat", "Romanian Deadlift", "Calf Raise"],
    Wed: [],
    Thu: ["Incline Press", "Pull-up", "Lateral Raise"],
    Fri: ["Deadlift", "Leg Press", "Hamstring Curl"],
    Sat: [],
    Sun: [],
  },
  "Full Body": {
    Mon: ["Squat", "Bench Press", "Barbell Row"],
    Tue: [],
    Wed: ["Deadlift", "Overhead Press", "Pull-up"],
    Thu: [],
    Fri: ["Leg Press", "Incline Press", "Lat Pulldown"],
    Sat: [],
    Sun: [],
  },
};

const state = {
  split: "Bro Split",
  day: weekDays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1],
  restDuration: DEFAULT_REST,
  workoutStart: null,
  workoutTimerId: null,
  restTimerId: null,
  restRemaining: DEFAULT_REST,
  restDueAt: null,
  restTimeoutId: null,
  chart: null,
  recentExercises: [],
};

const db = {
  instance: null,
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const dbInstance = event.target.result;
        if (!dbInstance.objectStoreNames.contains(STORES.SETTINGS)) {
          dbInstance.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.PROFILE)) {
          dbInstance.createObjectStore(STORES.PROFILE, { keyPath: "key" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.EXERCISES)) {
          dbInstance.createObjectStore(STORES.EXERCISES, { keyPath: "name" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.PLANS)) {
          dbInstance.createObjectStore(STORES.PLANS, { keyPath: "key" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.WORKOUTS)) {
          dbInstance.createObjectStore(STORES.WORKOUTS, { keyPath: "id" });
        }
        if (!dbInstance.objectStoreNames.contains(STORES.TIMELINE)) {
          dbInstance.createObjectStore(STORES.TIMELINE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        db.instance = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },
  async get(store, key) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readonly");
      const request = tx.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async set(store, value) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async getAll(store) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readonly");
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  async delete(store, key) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async clear(store) {
    return new Promise((resolve, reject) => {
      const tx = db.instance.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

const dom = {
  views: document.querySelectorAll(".view"),
  navLinks: document.querySelectorAll("[data-view]"),
  dayTabs: document.getElementById("dayTabs"),
  exerciseList: document.getElementById("exerciseList"),
  dayTitle: document.getElementById("dayTitle"),
  daySummary: document.getElementById("daySummary"),
  splitSelect: document.getElementById("splitSelect"),
  workoutDuration: document.getElementById("workoutDuration"),
  startWorkoutBtn: document.getElementById("startWorkoutBtn"),
  finishWorkoutBtn: document.getElementById("finishWorkoutBtn"),
  addExerciseBtn: document.getElementById("addExerciseBtn"),
  exerciseModal: document.getElementById("exerciseModal"),
  exerciseSearch: document.getElementById("exerciseSearch"),
  exerciseOptions: document.getElementById("exerciseOptions"),
  customExercise: document.getElementById("customExercise"),
  exerciseAddBtn: document.getElementById("exerciseAddBtn"),
  exerciseCancelBtn: document.getElementById("exerciseCancelBtn"),
  restTimer: document.getElementById("restTimer"),
  restTime: document.getElementById("restTime"),
  restMinus: document.getElementById("restMinus"),
  restPlus: document.getElementById("restPlus"),
  restStop: document.getElementById("restStop"),
  toast: document.getElementById("toast"),
  confetti: document.getElementById("confetti"),
  totalWorkouts: document.getElementById("totalWorkouts"),
  workoutStreak: document.getElementById("workoutStreak"),
  userLevel: document.getElementById("userLevel"),
  levelBadge: document.getElementById("levelBadge"),
  xpFill: document.getElementById("xpFill"),
  xpText: document.getElementById("xpText"),
  insightsList: document.getElementById("insightsList"),
  historyList: document.getElementById("historyList"),
  weeklyChart: document.getElementById("weeklyChart"),
  rmWeight: document.getElementById("rmWeight"),
  rmReps: document.getElementById("rmReps"),
  rmCalcBtn: document.getElementById("rmCalcBtn"),
  rmResult: document.getElementById("rmResult"),
  bmiWeight: document.getElementById("bmiWeight"),
  bmiHeight: document.getElementById("bmiHeight"),
  bmiAge: document.getElementById("bmiAge"),
  bmiGoal: document.getElementById("bmiGoal"),
  bmiCalcBtn: document.getElementById("bmiCalcBtn"),
  bmiResult: document.getElementById("bmiResult"),
  plateTarget: document.getElementById("plateTarget"),
  plateCalcBtn: document.getElementById("plateCalcBtn"),
  plateResult: document.getElementById("plateResult"),
  coachWeight: document.getElementById("coachWeight"),
  coachGoal: document.getElementById("coachGoal"),
  coachDiet: document.getElementById("coachDiet"),
  coachBtn: document.getElementById("coachBtn"),
  coachResult: document.getElementById("coachResult"),
  timelinePhoto: document.getElementById("timelinePhoto"),
  timelineNote: document.getElementById("timelineNote"),
  timelineAddBtn: document.getElementById("timelineAddBtn"),
  timelineGrid: document.getElementById("timelineGrid"),
  profileName: document.getElementById("profileName"),
  profileSaveBtn: document.getElementById("profileSaveBtn"),
  restDuration: document.getElementById("restDuration"),
  restSaveBtn: document.getElementById("restSaveBtn"),
  historyCalories: document.getElementById("historyCalories"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  importBtn: document.getElementById("importBtn"),
  resetBtn: document.getElementById("resetBtn"),
  offlineStatus: document.getElementById("offlineStatus"),
  offlineText: document.getElementById("offlineText"),
  shareBtn: document.getElementById("shareBtn"),
  updateModal: document.getElementById("updateModal"),
  updateBtn: document.getElementById("updateBtn"),
  resumeModal: document.getElementById("resumeModal"),
  resumeContinueBtn: document.getElementById("resumeContinueBtn"),
  resumeDiscardBtn: document.getElementById("resumeDiscardBtn"),
  cacheVersion: document.getElementById("cacheVersion"),
  mobileDaySplit: document.getElementById("mobileDaySplit"),
  mobileWorkoutDuration: document.getElementById("mobileWorkoutDuration"),
};

const formatTime = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

const getTodayKey = () => new Date().toDateString();

const calculateTodayVolume = (workouts) =>
  workouts
    .filter((workout) => new Date(workout.date).toDateString() === getTodayKey())
    .reduce((sum, workout) => sum + (Number(workout.totalVolume) || 0), 0);

const updateHistoryCalories = (workouts) => {
  if (!dom.historyCalories) return;
  const volume = calculateTodayVolume(workouts);
  const calories = Math.round(volume * 0.06);
  dom.historyCalories.textContent = volume ? `${calories} kcal` : "--";
};

const escapeSelector = (value) => {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
};

const showToast = (message) => {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  setTimeout(() => dom.toast.classList.remove("show"), 2400);
};

const blastConfetti = () => {
  dom.confetti.style.animation = "none";
  dom.confetti.offsetHeight;
  dom.confetti.style.animation = "";
};

const playAlarm = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    gain.connect(ctx.destination);
    let at = ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 0.18);
      at += 0.28;
    }
    setTimeout(() => ctx.close(), 1200);
  } catch (error) {
    // Audio context can be blocked, fallback to vibration only.
  }
  if (navigator.vibrate) {
    navigator.vibrate([200, 120, 200, 120, 200]);
  }
};

const updateOfflineStatus = () => {
  const online = navigator.onLine;
  dom.offlineStatus.classList.toggle("offline", !online);
  dom.offlineText.textContent = online ? "Offline-ready" : "Offline mode";
};

const setView = async (viewId) => {
  dom.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  dom.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === viewId));
  if (viewId === "history") {
    await renderHistory();
  }
  if (viewId === "timeline") {
    await renderTimeline();
  }
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", lastView: viewId });
};

const createDayTabs = () => {
  dom.dayTabs.innerHTML = "";
  weekDays.forEach((day) => {
    const btn = document.createElement("button");
    btn.className = `day-tab${day === state.day ? " active" : ""}`;
    btn.textContent = day;
    btn.addEventListener("click", () => {
      state.day = day;
      renderWorkoutDay();
    });
    dom.dayTabs.appendChild(btn);
  });
};

const getPlanKey = () => `${state.split}:${state.day}`;

const getPlanExercises = async () => {
  const custom = await db.get(STORES.PLANS, getPlanKey());
  if (custom?.exercises) {
    return custom.exercises;
  }
  return splitTemplates[state.split][state.day] || [];
};

const savePlanExercises = async (exercises) => {
  await db.set(STORES.PLANS, { key: getPlanKey(), exercises });
};

const updateWorkoutTimer = () => {
  if (!state.workoutStart) {
    dom.workoutDuration.textContent = "00:00";
    if (dom.mobileWorkoutDuration) {
      dom.mobileWorkoutDuration.textContent = "00:00";
    }
    return;
  }
  const seconds = Math.floor((Date.now() - state.workoutStart) / 1000);
  dom.workoutDuration.textContent = formatTime(seconds);
  if (dom.mobileWorkoutDuration) {
    dom.mobileWorkoutDuration.textContent = formatTime(seconds);
  }
};

const startWorkoutTimer = () => {
  if (state.workoutTimerId) return;
  if (!state.workoutStart) {
    state.workoutStart = Date.now();
  }
  state.workoutTimerId = setInterval(updateWorkoutTimer, 1000);
};

const stopWorkoutTimer = () => {
  clearInterval(state.workoutTimerId);
  state.workoutTimerId = null;
  state.workoutStart = null;
  dom.workoutDuration.textContent = "00:00";
};

const startRestTimer = (seconds) => {
  state.restRemaining = seconds;
  state.restDueAt = Date.now() + seconds * 1000;
  dom.restTime.textContent = state.restRemaining;
  dom.restTimer.classList.add("active");
  clearInterval(state.restTimerId);
  clearTimeout(state.restTimeoutId);
  state.restTimeoutId = null;
  state.restTimerId = setInterval(() => {
    state.restRemaining -= 1;
    dom.restTime.textContent = state.restRemaining;
    if (state.restRemaining <= 0) {
      clearInterval(state.restTimerId);
      dom.restTimer.classList.remove("active");
      state.restDueAt = null;
      playAlarm();
    }
  }, 1000);
};

const stopRestTimer = () => {
  clearInterval(state.restTimerId);
  clearTimeout(state.restTimeoutId);
  state.restTimeoutId = null;
  state.restDueAt = null;
  dom.restTimer.classList.remove("active");
};

const renderExerciseCard = async (name, index) => {
  const exerciseData = (await db.get(STORES.EXERCISES, name)) || {
    name,
    notes: "",
    lastWeight: "",
    lastReps: "",
    prs: [],
  };
  const card = document.createElement("div");
  card.className = "exercise-card";
  card.dataset.exercise = name;
  const lastWeight = Number(exerciseData.lastWeight) || 0;
  const lastReps = Number(exerciseData.lastReps) || 0;
  const lastText = lastWeight && lastReps ? `${lastWeight}kg x ${lastReps}` : "No last data";
  const latestPr = (exerciseData.prs || [])[0];
  const prText = latestPr ? `Best: ${latestPr.weight}kg x ${latestPr.reps}` : "Best: -";

  card.innerHTML = `
    <div class="exercise-title">
      <strong>${name}</strong>
      <button class="chip remove-exercise" data-index="${index}">Remove</button>
    </div>
    <input class="field exercise-notes" type="text" placeholder="Notes" value="${exerciseData.notes || ""}" />
    <div class="muted last-stats">Last: ${lastText}</div>
    <div class="muted last-stats pr-history">${prText}</div>
    <div class="set-grid">
      ${[1, 2, 3]
        .map(
          (setNum) => `
        <div class="set-row">
          <span>Set ${setNum}</span>
          <input class="field set-weight" type="number" inputmode="numeric" placeholder="kg" value="${exerciseData.lastWeight || ""}" />
          <input class="field set-reps" type="number" inputmode="numeric" placeholder="reps" value="${exerciseData.lastReps || ""}" />
          <button class="set-toggle" data-set="${setNum}">Done</button>
        </div>`
        )
        .join("")}
    </div>
  `;

  card.querySelector(".exercise-notes").addEventListener("change", async (event) => {
    await db.set(STORES.EXERCISES, { ...exerciseData, notes: event.target.value, name });
  });

  card.querySelectorAll(".set-weight").forEach((input) => {
    input.addEventListener("input", () => {
      input.classList.toggle("improve", Number(input.value) > lastWeight);
    });
  });

  card.querySelectorAll(".set-reps").forEach((input) => {
    input.addEventListener("input", () => {
      input.classList.toggle("improve", Number(input.value) > lastReps);
    });
  });

  card.querySelectorAll(".set-toggle").forEach((toggle) => {
    toggle.addEventListener("click", async () => {
      const row = toggle.closest(".set-row");
      if (!row) return;
      const wasDone = toggle.classList.contains("done");
      toggle.classList.toggle("done");
      if (!wasDone && toggle.classList.contains("done")) {
        await handleSetCompletion(card, row);
      }
    });
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const row = event.target.closest(".set-row");
    if (!row) return;
    event.preventDefault();
    const toggle = row.querySelector(".set-toggle");
    if (toggle && !toggle.classList.contains("done")) {
      toggle.click();
    }
  });

  card.querySelector(".remove-exercise").addEventListener("click", async () => {
    const exercises = await getPlanExercises();
    exercises.splice(index, 1);
    await savePlanExercises(exercises);
    renderWorkoutDay();
  });

  return card;
};

const renderWorkoutDay = async () => {
  createDayTabs();
  dom.dayTitle.textContent = `${state.day} - ${state.split}`;
  if (dom.mobileDaySplit) {
    dom.mobileDaySplit.textContent = `${state.day} - ${state.split}`;
  }
  const exercises = await getPlanExercises();
  dom.exerciseList.innerHTML = "";

  if (!exercises.length) {
    dom.daySummary.textContent = "Rest day. Reset and recover.";
    dom.exerciseList.innerHTML = `<div class="exercise-card">No exercises scheduled.</div>`;
    return;
  }

  dom.daySummary.textContent = `${exercises.length} exercises  -  3 sets each`;
  for (let i = 0; i < exercises.length; i += 1) {
    const card = await renderExerciseCard(exercises[i], i);
    dom.exerciseList.appendChild(card);
  }

  const settings = await db.get(STORES.SETTINGS, "settings");
  const workout = settings?.currentWorkout;
  if (workout && workout.day === state.day && workout.split === state.split) {
    applyWorkoutState(workout);
  }
};

const handleSetCompletion = async (card, row) => {
  startWorkoutTimer();
  const weightInput = row.querySelector(".set-weight");
  const repsInput = row.querySelector(".set-reps");
  const weight = Number(weightInput.value) || 0;
  const reps = Number(repsInput.value) || 0;
  const exerciseName = card.dataset.exercise;
  const prior = (await db.get(STORES.EXERCISES, exerciseName)) || {};
  const isPr = weight > (prior.lastWeight || 0) || reps > (prior.lastReps || 0);
  const prs = Array.isArray(prior.prs) ? prior.prs.slice() : [];
  if (isPr) {
    prs.unshift({ weight, reps, date: new Date().toISOString() });
  }
  await db.set(STORES.EXERCISES, {
    name: exerciseName,
    lastWeight: weight,
    lastReps: reps,
    notes: card.querySelector(".exercise-notes").value || "",
    prs: prs.slice(0, 5),
  });
  if (isPr) {
    card.classList.add("pr");
    showToast("PR! New personal best.");
  }
  if (row.dataset.xpAwarded !== "true") {
    row.dataset.xpAwarded = "true";
    await applyXp(10);
  }
  startRestTimer(state.restDuration);
  focusNextInput(card);
  updateWorkoutState();
};

const focusNextInput = (card) => {
  const inputs = Array.from(card.querySelectorAll(".set-weight, .set-reps"));
  const current = document.activeElement;
  const idx = inputs.indexOf(current);
  if (idx !== -1 && inputs[idx + 1]) {
    inputs[idx + 1].focus();
    return;
  }
  const nextCard = card.nextElementSibling;
  if (nextCard) {
    const nextInput = nextCard.querySelector(".set-weight");
    if (nextInput) nextInput.focus();
  }
};

const updateWorkoutState = async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  const exercises = Array.from(dom.exerciseList.querySelectorAll(".exercise-card"));
  const workout = {
    split: state.split,
    day: state.day,
    startTime: state.workoutStart,
    exercises: exercises.map((card) => ({
      name: card.dataset.exercise,
      notes: card.querySelector(".exercise-notes").value || "",
      sets: Array.from(card.querySelectorAll(".set-row")).map((row) => ({
        weight: Number(row.querySelector(".set-weight").value) || 0,
        reps: Number(row.querySelector(".set-reps").value) || 0,
        done: row.querySelector(".set-toggle").classList.contains("done"),
      })),
    })),
  };
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", currentWorkout: workout });
};

const applyWorkoutState = (workout) => {
  if (!workout?.exercises) return;
  workout.exercises.forEach((exercise) => {
    const selector = `[data-exercise="${escapeSelector(exercise.name)}"]`;
    const card = dom.exerciseList.querySelector(selector);
    if (!card) return;
    const notes = card.querySelector(".exercise-notes");
    if (notes) notes.value = exercise.notes || "";
    const rows = card.querySelectorAll(".set-row");
    (exercise.sets || []).forEach((set, index) => {
      const row = rows[index];
      if (!row) return;
      const weight = row.querySelector(".set-weight");
      const reps = row.querySelector(".set-reps");
      if (weight) weight.value = set.weight || "";
      if (reps) reps.value = set.reps || "";
      const toggle = row.querySelector(".set-toggle");
      if (toggle && set.done) {
        toggle.classList.add("done");
        row.dataset.xpAwarded = "true";
      }
    });
  });
};

const applyXp = async (amount) => {
  const profile = (await db.get(STORES.PROFILE, "profile")) || {
    key: "profile",
    username: "",
    totalXp: 0,
    level: 1,
  };
  const totalXp = profile.totalXp + amount;
  const level = Math.floor(totalXp / 1000) + 1;
  await db.set(STORES.PROFILE, { ...profile, totalXp, level });
  updateXpUi(totalXp, level);
  showToast(`+${amount} XP`);
};

const updateXpUi = (totalXp, level) => {
  const levelXp = totalXp % 1000;
  dom.levelBadge.textContent = `Lv ${level}`;
  dom.userLevel.textContent = level;
  dom.xpText.textContent = `${levelXp} / 1000 XP`;
  dom.xpFill.style.width = `${Math.min(100, (levelXp / 1000) * 100)}%`;
};

const calculateWorkoutSummary = () => {
  const exercises = Array.from(dom.exerciseList.querySelectorAll(".exercise-card"));
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  exercises.forEach((card) => {
    card.querySelectorAll(".set-row").forEach((row) => {
      const done = row.querySelector(".set-toggle").classList.contains("done");
      if (!done) return;
      totalSets += 1;
      const weight = Number(row.querySelector(".set-weight").value) || 0;
      const reps = Number(row.querySelector(".set-reps").value) || 0;
      totalReps += reps;
      totalVolume += weight * reps;
    });
  });
  return {
    exercisesCount: exercises.length,
    totalSets,
    totalReps,
    totalVolume,
  };
};

const finishWorkout = async () => {
  if (!state.workoutStart) {
    showToast("No workout in progress.");
    return;
  }
  const summary = calculateWorkoutSummary();
  const endTime = Date.now();
  const duration = Math.ceil((endTime - state.workoutStart) / 60000);
  await applyXp(100);
  const workout = {
    id: `w_${Date.now()}`,
    date: new Date().toISOString(),
    day: state.day,
    split: state.split,
    startTime: state.workoutStart,
    endTime,
    duration,
    xp: 100 + summary.totalSets * 10,
    exercisesCount: summary.exercisesCount,
    totalSets: summary.totalSets,
    totalReps: summary.totalReps,
    totalVolume: summary.totalVolume,
  };
  await db.set(STORES.WORKOUTS, workout);
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", currentWorkout: null });
  stopWorkoutTimer();
  blastConfetti();
  showToast("Workout complete!");
  await refreshDashboard();
  await renderHistory();
};

const refreshDashboard = async () => {
  const workouts = await db.getAll(STORES.WORKOUTS);
  dom.totalWorkouts.textContent = workouts.length;
  dom.workoutStreak.textContent = `${calculateStreak(workouts)} days`;

  const profile = await db.get(STORES.PROFILE, "profile");
  updateXpUi(profile?.totalXp || 0, profile?.level || 1);

  renderWeeklyChart(workouts);
  renderInsights(workouts);
  updateHistoryCalories(workouts);
};

const calculateStreak = (workouts) => {
  const dates = workouts.map((w) => new Date(w.date).toDateString());
  const uniqueDates = [...new Set(dates)];
  let streak = 0;
  let current = new Date();
  while (uniqueDates.includes(current.toDateString())) {
    streak += 1;
    current.setDate(current.getDate() - 1);
  }
  return streak;
};

const renderWeeklyChart = (workouts) => {
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    labels.push(label);
    const count = workouts.filter(
      (w) => new Date(w.date).toDateString() === date.toDateString()
    ).length;
    data.push(count);
  }

  if (state.chart) {
    state.chart.update(labels, data);
  } else {
    state.chart = new Chart(dom.weeklyChart.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{ data, backgroundColor: "#ff8a3d" }],
      },
    });
  }
};

const renderInsights = (workouts) => {
  if (!workouts.length) {
    dom.insightsList.innerHTML = "<li>Complete a workout to unlock insights.</li>";
    return;
  }
  const last = workouts[workouts.length - 1];
  dom.insightsList.innerHTML = `
    <li>Last workout: ${last.duration} min  -  ${last.totalSets} sets</li>
    <li>Total volume: ${last.totalVolume} kg</li>
    <li>XP earned: ${last.xp}</li>
  `;
};

const renderHistory = async () => {
  const workouts = await db.getAll(STORES.WORKOUTS);
  dom.historyList.innerHTML = "";
  workouts.slice().reverse().forEach((workout) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <strong>${new Date(workout.date).toLocaleDateString()}</strong>
      <span class="muted">${workout.day}  -  ${workout.duration} min  -  ${workout.xp} XP</span>
      <span class="muted">${workout.exercisesCount} exercises  -  ${workout.totalSets} sets  -  ${workout.totalVolume} kg</span>
    `;
    dom.historyList.appendChild(item);
  });
  updateHistoryCalories(workouts);
};

const renderTimeline = async () => {
  const items = await db.getAll(STORES.TIMELINE);
  dom.timelineGrid.innerHTML = "";
  items.slice().reverse().forEach((item) => {
    const card = document.createElement("div");
    card.className = "timeline-item";
    const url = item.photo ? URL.createObjectURL(item.photo) : "";
    card.innerHTML = `
      ${item.photo ? `<img src="${url}" alt="Workout" />` : ""}
      <strong>${new Date(item.date).toLocaleDateString()}</strong>
      <span class="muted">${item.note || ""}</span>
      <button class="chip" data-id="${item.id}">Delete</button>
    `;
    card.querySelector("button").addEventListener("click", async () => {
      await db.delete(STORES.TIMELINE, item.id);
      if (url) URL.revokeObjectURL(url);
      renderTimeline();
    });
    dom.timelineGrid.appendChild(card);
  });
};

const addTimelineEntry = async () => {
  const file = dom.timelinePhoto.files[0];
  const note = dom.timelineNote.value.trim();
  if (!file && !note) {
    showToast("Add a photo or note.");
    return;
  }
  const entry = {
    id: `t_${Date.now()}`,
    date: new Date().toISOString(),
    note,
    photo: file || null,
  };
  await db.set(STORES.TIMELINE, entry);
  dom.timelinePhoto.value = "";
  dom.timelineNote.value = "";
  showToast("Timeline updated.");
  renderTimeline();
};

const setupExerciseModal = async () => {
  const exercises = await getPlanExercises();
  const options = [...new Set([...state.recentExercises, ...defaultExerciseLibrary])];
  const filter = dom.exerciseSearch.value.toLowerCase();
  dom.exerciseOptions.innerHTML = "";
  options
    .filter((name) => name.toLowerCase().includes(filter))
    .forEach((name) => {
      const option = document.createElement("div");
      option.className = "exercise-option";
      option.textContent = name;
      option.addEventListener("click", () => {
        dom.customExercise.value = name;
      });
      dom.exerciseOptions.appendChild(option);
    });
  dom.exerciseAddBtn.onclick = async () => {
    const newExercise = dom.customExercise.value.trim();
    if (!newExercise) return;
    const updated = [...exercises, newExercise];
    await savePlanExercises(updated);
    state.recentExercises = [newExercise, ...state.recentExercises.filter((e) => e !== newExercise)].slice(0, 6);
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", recentExercises: state.recentExercises });
    dom.exerciseModal.classList.remove("open");
    dom.customExercise.value = "";
    dom.exerciseSearch.value = "";
    renderWorkoutDay();
  };
};

const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").then((registration) => {
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          dom.updateModal.classList.add("open");
        }
      });
    });
  });
};

const syncCacheVersion = () => {
  if (dom.cacheVersion) {
    dom.cacheVersion.textContent = APP_CACHE_VERSION;
  }
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: "GET_VERSION" });
};

const setupNav = () => {
  dom.navLinks.forEach((link) => {
    link.addEventListener("click", () => setView(link.dataset.view));
  });
};

const setupTools = () => {
  dom.rmCalcBtn.addEventListener("click", () => {
    const weight = Number(dom.rmWeight.value);
    const reps = Number(dom.rmReps.value);
    if (!weight || !reps) {
      dom.rmResult.textContent = "Enter weight and reps.";
      return;
    }
    if (reps < 1 || reps > 12) {
      dom.rmResult.textContent = "Reps must be 1-12.";
      return;
    }
    const oneRm = weight * (1 + reps / 30);
    dom.rmResult.textContent = `1RM: ${oneRm.toFixed(1)} kg  -  70% ${(oneRm * 0.7).toFixed(1)} kg  -  80% ${(oneRm * 0.8).toFixed(1)} kg  -  90% ${(oneRm * 0.9).toFixed(1)} kg`;
  });

  dom.bmiCalcBtn.addEventListener("click", () => {
    const weight = Number(dom.bmiWeight.value);
    const height = Number(dom.bmiHeight.value);
    const age = Number(dom.bmiAge.value);
    if (!weight || !height || !age) {
      dom.bmiResult.textContent = "Enter weight, height, and age.";
      return;
    }
    if (height <= 0 || weight <= 0) {
      dom.bmiResult.textContent = "Enter valid values.";
      return;
    }
    const bmi = weight / Math.pow(height / 100, 2);
    const baseCalories = weight * 30;
    const goal = dom.bmiGoal.value;
    const adjust = goal === "Cut" ? -300 : goal === "Bulk" ? 300 : 0;
    dom.bmiResult.textContent = `BMI ${bmi.toFixed(1)}  -  Daily calories ~${baseCalories + adjust} kcal`;
  });

  dom.plateCalcBtn.addEventListener("click", () => {
    const target = Number(dom.plateTarget.value);
    if (!target || target < 20) {
      dom.plateResult.textContent = "Enter target >= 20kg.";
      return;
    }
    const plates = [20, 15, 10, 5, 2.5, 1.25];
    let remaining = (target - 20) / 2;
    const breakdown = [];
    plates.forEach((plate) => {
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        breakdown.push(`${count}x${plate}kg`);
        remaining -= count * plate;
      }
    });
    dom.plateResult.textContent = breakdown.length ? breakdown.join("  -  ") : "Just the bar.";
  });

  dom.coachBtn.addEventListener("click", () => {
    const weight = Number(dom.coachWeight.value);
    if (!weight) {
      dom.coachResult.textContent = "Enter body weight.";
      return;
    }
    const goal = dom.coachGoal.value;
    const diet = dom.coachDiet.value;
    const base = weight * 30;
    const calories = goal === "Cut" ? base - 400 : goal === "Bulk" ? base + 300 : base;
    const protein = Math.round(weight * 2);
    dom.coachResult.textContent = `${goal}  -  ${diet}  -  ${calories} kcal  -  ${protein}g protein  -  Split meals into 3-4 servings with veggies + carbs.`;
  });
};

const setupSettings = () => {
  dom.profileSaveBtn.addEventListener("click", async () => {
    const profile = (await db.get(STORES.PROFILE, "profile")) || {
      key: "profile",
      totalXp: 0,
      level: 1,
    };
    await db.set(STORES.PROFILE, { ...profile, key: "profile", username: dom.profileName.value.trim() });
    showToast("Profile saved.");
  });

  dom.restSaveBtn.addEventListener("click", async () => {
    const value = Number(dom.restDuration.value);
    if (!value) return;
    state.restDuration = value;
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, { ...settings, key: "settings", restDuration: value });
    showToast("Rest timer saved.");
  });

  document.querySelectorAll("[data-rest]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = Number(button.dataset.rest);
      state.restDuration = value;
      dom.restDuration.value = value;
      const settings = await db.get(STORES.SETTINGS, "settings");
      await db.set(STORES.SETTINGS, { ...settings, key: "settings", restDuration: value });
      showToast("Rest timer updated.");
    });
  });

  dom.exportBtn.addEventListener("click", async () => {
    const payload = {
      settings: await db.get(STORES.SETTINGS, "settings"),
      profile: await db.get(STORES.PROFILE, "profile"),
      exercises: await db.getAll(STORES.EXERCISES),
      plans: await db.getAll(STORES.PLANS),
      workouts: await db.getAll(STORES.WORKOUTS),
      timeline: await Promise.all(
        (await db.getAll(STORES.TIMELINE)).map(async (entry) => ({
          ...entry,
          photo: entry.photo ? await blobToDataUrl(entry.photo) : null,
        }))
      ),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ironai-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  dom.importBtn.addEventListener("click", async () => {
    const file = dom.importFile.files[0];
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text);
    await db.set(STORES.SETTINGS, { ...payload.settings, key: "settings" });
    await db.set(STORES.PROFILE, { ...payload.profile, key: "profile" });
    for (const exercise of payload.exercises || []) {
      await db.set(STORES.EXERCISES, exercise);
    }
    for (const plan of payload.plans || []) {
      await db.set(STORES.PLANS, plan);
    }
    for (const workout of payload.workouts || []) {
      await db.set(STORES.WORKOUTS, workout);
    }
    for (const entry of payload.timeline || []) {
      const photo = entry.photo ? dataUrlToBlob(entry.photo) : null;
      await db.set(STORES.TIMELINE, { ...entry, photo });
    }
    showToast("Backup restored.");
    await bootstrap();
  });

  dom.resetBtn.addEventListener("click", async () => {
    if (!confirm("Delete all local data?")) return;
    await db.clear(STORES.SETTINGS);
    await db.clear(STORES.PROFILE);
    await db.clear(STORES.EXERCISES);
    await db.clear(STORES.PLANS);
    await db.clear(STORES.WORKOUTS);
    await db.clear(STORES.TIMELINE);
    showToast("Data reset.");
    await bootstrap();
  });
};

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = (dataUrl) => {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(content);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
};

const bootstrap = async () => {
  await db.init();
  const settings = (await db.get(STORES.SETTINGS, "settings")) || {
    key: "settings",
    split: "Bro Split",
    restDuration: DEFAULT_REST,
    lastView: "dashboard",
    currentWorkout: null,
    recentExercises: [],
  };
  await db.set(STORES.SETTINGS, settings);
  state.split = settings.split;
  state.restDuration = settings.restDuration || DEFAULT_REST;
  state.recentExercises = settings.recentExercises || [];
  state.workoutStart = settings.currentWorkout?.startTime || null;
  syncCacheVersion();

  const profile = (await db.get(STORES.PROFILE, "profile")) || {
    key: "profile",
    username: "",
    totalXp: 0,
    level: 1,
  };
  await db.set(STORES.PROFILE, profile);

  dom.profileName.value = profile.username || "";
  dom.restDuration.value = state.restDuration;
  dom.splitSelect.value = state.split;

  createDayTabs();
  await renderWorkoutDay();
  await refreshDashboard();
  await renderHistory();
  await renderTimeline();

  if (settings.lastView) {
    setView(settings.lastView);
  }

  if (settings.currentWorkout?.startTime) {
    dom.resumeModal?.classList.add("open");
  } else {
    state.workoutStart = null;
  }
};

dom.splitSelect.addEventListener("change", async (event) => {
  state.split = event.target.value;
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", split: state.split });
  renderWorkoutDay();
});


dom.startWorkoutBtn.addEventListener("click", async () => {
  setView("lift");
  if (!state.workoutStart) {
    state.workoutStart = Date.now();
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, {
      ...settings,
      key: "settings",
      currentWorkout: { startTime: state.workoutStart, split: state.split, day: state.day },
    });
    await updateWorkoutState();
  }
  startWorkoutTimer();
  showToast("Workout started.");
});

dom.finishWorkoutBtn.addEventListener("click", finishWorkout);

dom.addExerciseBtn.addEventListener("click", () => {
  dom.exerciseModal.classList.add("open");
  setupExerciseModal();
});

dom.exerciseCancelBtn.addEventListener("click", () => {
  dom.exerciseModal.classList.remove("open");
});

dom.exerciseSearch.addEventListener("input", setupExerciseModal);

dom.restMinus.addEventListener("click", () => {
  state.restRemaining = Math.max(0, state.restRemaining - 10);
  dom.restTime.textContent = state.restRemaining;
});

dom.restPlus.addEventListener("click", () => {
  state.restRemaining += 10;
  dom.restTime.textContent = state.restRemaining;
});

dom.restStop.addEventListener("click", stopRestTimer);

dom.timelineAddBtn.addEventListener("click", addTimelineEntry);

dom.shareBtn.addEventListener("click", async () => {
  if (navigator.share) {
    await navigator.share({
      title: "IronAI Fitness",
      text: "Offline-first personal gym tracker.",
      url: location.href,
    });
  } else {
    showToast("Share not supported.");
  }
});

dom.resumeContinueBtn?.addEventListener("click", () => {
  dom.resumeModal.classList.remove("open");
  startWorkoutTimer();
});

dom.resumeDiscardBtn?.addEventListener("click", async () => {
  dom.resumeModal.classList.remove("open");
  stopWorkoutTimer();
  stopRestTimer();
  state.restRemaining = DEFAULT_REST;
  dom.restTime.textContent = state.restRemaining;
  const settings = await db.get(STORES.SETTINGS, "settings");
  state.workoutStart = null;
  await db.set(STORES.SETTINGS, {
    ...settings,
    key: "settings",
    currentWorkout: null,
  });
  renderWorkoutDay();
  showToast("Workout discarded.");
});

dom.updateBtn.addEventListener("click", () => {
  window.location.reload();
});

window.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state.workoutTimerId) {
      clearInterval(state.workoutTimerId);
      state.workoutTimerId = null;
    }
    if (state.restTimerId) {
      clearInterval(state.restTimerId);
      state.restTimerId = null;
      state.restDueAt = Date.now() + state.restRemaining * 1000;
      state.restTimeoutId = setTimeout(() => {
        state.restRemaining = 0;
        dom.restTimer.classList.remove("active");
        state.restDueAt = null;
        state.restTimeoutId = null;
        playAlarm();
      }, Math.max(0, state.restRemaining * 1000));
    }
  } else {
    if (state.workoutStart && !state.workoutTimerId) {
      startWorkoutTimer();
    }
    if (state.restDueAt) {
      const remaining = Math.max(0, Math.ceil((state.restDueAt - Date.now()) / 1000));
      state.restRemaining = remaining;
      dom.restTime.textContent = state.restRemaining;
      if (remaining > 0) {
        dom.restTimer.classList.add("active");
        startRestTimer(remaining);
      } else {
        dom.restTimer.classList.remove("active");
      }
      state.restDueAt = null;
      clearTimeout(state.restTimeoutId);
      state.restTimeoutId = null;
    }
  }
});

window.addEventListener("online", updateOfflineStatus);
window.addEventListener("offline", updateOfflineStatus);
navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_VERSION" && dom.cacheVersion) {
    dom.cacheVersion.textContent = event.data.version;
  }
});

setupNav();
setupTools();
setupSettings();
updateOfflineStatus();
registerServiceWorker();
bootstrap();



