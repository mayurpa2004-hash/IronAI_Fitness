
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

const APP_CACHE_VERSION = "ironai-v11";

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
  "Default": {
    Mon: ["Bench Press", "Incline DB Press", "Tricep Pushdown"],
    Tue: ["Deadlift", "Barbell Row", "Lat Pulldown", "Barbell Curl"],
    Wed: ["Squat", "Leg Press", "Overhead Press", "Lateral Raise"],
    Thu: ["Bench Press", "Incline DB Press", "Tricep Pushdown"],
    Fri: ["Deadlift", "Barbell Row", "Lat Pulldown", "Barbell Curl"],
    Sat: ["Squat", "Leg Press", "Overhead Press", "Lateral Raise"],
    Sun: [],
  },};

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
  resumePromptOpen: false,
  awaitingResume: false,
  pendingElapsedMs: 0,
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
  historyDetailModal: document.getElementById("historyDetailModal"),
  historyDetailContent: document.getElementById("historyDetailContent"),
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

const calculateTodayCalories = (workouts) => {
  const todayWorkouts = workouts.filter(
    (workout) => new Date(workout.date).toDateString() === getTodayKey()
  );
  const calories = todayWorkouts.reduce((sum, workout) => {
    const stored = Number(workout.caloriesBurned);
    if (Number.isFinite(stored)) return sum + stored;
    const volume = Number(workout.totalVolumeKg ?? workout.totalVolume) || 0;
    return sum + Math.round(volume * 0.06);
  }, 0);
  return { count: todayWorkouts.length, calories };
};

const updateHistoryCalories = (workouts) => {
  if (!dom.historyCalories) return;
  const { count, calories } = calculateTodayCalories(workouts);
  dom.historyCalories.textContent = count ? `${calories} kcal` : "--";
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
  const elapsedMs = state.awaitingResume
    ? state.pendingElapsedMs
    : Date.now() - state.workoutStart;
  const seconds = Math.floor(elapsedMs / 1000);
  dom.workoutDuration.textContent = formatTime(seconds);
  if (dom.mobileWorkoutDuration) {
    dom.mobileWorkoutDuration.textContent = formatTime(seconds);
  }
};

const startWorkoutTimer = () => {
  if (state.workoutTimerId) return;
  if (!state.workoutStart) return;
  updateWorkoutTimer();
  state.workoutTimerId = setInterval(updateWorkoutTimer, 1000);
};

const stopWorkoutTimer = () => {
  clearInterval(state.workoutTimerId);
  state.workoutTimerId = null;
  state.workoutStart = null;
  dom.workoutDuration.textContent = "00:00";
  if (dom.mobileWorkoutDuration) {
    dom.mobileWorkoutDuration.textContent = "00:00";
  }
};

const clearCurrentWorkout = async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  await db.set(STORES.SETTINGS, { ...settings, key: "settings", currentWorkout: null });
};

const resumeWorkout = () => {
  state.resumePromptOpen = false;
  dom.resumeModal?.classList.remove("open");
  state.workoutStart = Date.now() - state.pendingElapsedMs;
  console.log("[workout] resume adjusted startTime", state.workoutStart);
  void updateCurrentWorkoutStart();
  state.awaitingResume = false;
  state.pendingElapsedMs = 0;
  updateWorkoutTimer();
  startWorkoutTimer();
  console.log("[workout] resume");
};

const resetWorkout = async () => {
  state.resumePromptOpen = false;
  dom.resumeModal?.classList.remove("open");
  state.awaitingResume = false;
  state.pendingElapsedMs = 0;
  stopWorkoutTimer();
  stopRestTimer();
  state.restRemaining = DEFAULT_REST;
  dom.restTime.textContent = state.restRemaining;
  await clearCurrentWorkout();
  renderWorkoutDay();
  showToast("Workout discarded.");
  console.log("[workout] reset");
};

const openResumePrompt = async () => {
  if (dom.resumeModal && dom.resumeContinueBtn && dom.resumeDiscardBtn) {
    state.resumePromptOpen = true;
    dom.resumeModal.classList.add("open");
    return;
  }
  const resume = confirm("Resume timer?");
  if (resume) {
    resumeWorkout();
  } else {
    await resetWorkout();
  }
};

const updateCurrentWorkoutStart = async () => {
  const settings = await db.get(STORES.SETTINGS, "settings");
  const workout = settings?.currentWorkout;
  if (!workout || !state.workoutStart) return;
  await db.set(STORES.SETTINGS, {
    ...settings,
    key: "settings",
    currentWorkout: { ...workout, startTime: state.workoutStart },
  });
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
  if (!state.workoutStart) return;
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

const buildWorkoutExercisesFromDom = () => {
  const cards = Array.from(dom.exerciseList.querySelectorAll(".exercise-card"));
  return cards.map((card) => {
    const sets = [];
    card.querySelectorAll(".set-row").forEach((row) => {
      const weightValue = row.querySelector(".set-weight").value;
      const repsValue = row.querySelector(".set-reps").value;
      const weight = Number(weightValue);
      const reps = Number(repsValue);
      sets.push({
        weight: Number.isFinite(weight) ? weight : null,
        reps: Number.isFinite(reps) ? reps : null,
        done: row.querySelector(".set-toggle").classList.contains("done"),
      });
    });
    return {
      name: card.dataset.exercise,
      notes: card.querySelector(".exercise-notes")?.value || "",
      sets,
    };
  });
};

const calculateWorkoutSummary = (exercises) => {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let exercisesCount = 0;
  exercises.forEach((exercise) => {
    let exerciseHasSet = false;
    (exercise.sets || []).forEach((set) => {
      const weight = Number(set.weight);
      const reps = Number(set.reps);
      if (!Number.isFinite(weight) || weight < 0) return;
      if (!Number.isFinite(reps) || reps <= 0) return;
      exerciseHasSet = true;
      totalSets += 1;
      totalReps += reps;
      totalVolume += weight * reps;
    });
    if (exerciseHasSet) exercisesCount += 1;
  });
  return {
    exercisesCount,
    totalSets,
    totalReps,
    totalVolume,
  };
};

const calculateWorkoutSummaryFromDom = () => {
  const exercises = Array.from(dom.exerciseList.querySelectorAll(".exercise-card"));
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let exercisesCount = 0;
  exercises.forEach((card) => {
    let exerciseHasSet = false;
    card.querySelectorAll(".set-row").forEach((row) => {
      const weight = Number(row.querySelector(".set-weight").value);
      const reps = Number(row.querySelector(".set-reps").value);
      if (!Number.isFinite(weight) || weight < 0) return;
      if (!Number.isFinite(reps) || reps <= 0) return;
      exerciseHasSet = true;
      totalSets += 1;
      totalReps += reps;
      totalVolume += weight * reps;
    });
    if (exerciseHasSet) exercisesCount += 1;
  });
  return {
    exercisesCount,
    totalSets,
    totalReps,
    totalVolume,
  };
};

const calculateCaloriesBurned = (totalVolumeKg, durationSec) => {
  const durationMin = Math.max(1, Math.round(durationSec / 60));
  if (!totalVolumeKg) {
    return Math.min(1200, Math.max(10, Math.round(durationMin * 2)));
  }
  const caloriesFromVolume = totalVolumeKg * 0.035;
  const caloriesFromTime = durationMin * 3;
  const calories = Math.round(caloriesFromVolume + caloriesFromTime);
  return Math.min(1200, Math.max(10, calories));
};

const finishWorkout = async () => {
  if (!state.workoutStart) {
    showToast("No workout in progress.");
    return;
  }
  const exercises = buildWorkoutExercisesFromDom();
  const summary = calculateWorkoutSummaryFromDom();
  const endTime = Date.now();
  const durationSec = Math.max(1, Math.floor((endTime - state.workoutStart) / 1000));
  const duration = Math.max(1, Math.ceil(durationSec / 60));
  const caloriesBurned = calculateCaloriesBurned(summary.totalVolume, durationSec);
  await applyXp(100);
  const workout = {
    id: `w_${Date.now()}`,
    date: new Date().toISOString(),
    day: state.day,
    split: state.split,
    startTime: state.workoutStart,
    endTime,
    durationSec,
    duration,
    xp: 100 + summary.totalSets * 10,
    exercisesCount: summary.exercisesCount,
    totalSets: summary.totalSets,
    totalReps: summary.totalReps,
    totalVolume: summary.totalVolume,
    totalVolumeKg: summary.totalVolume,
    caloriesBurned,
    exercises,
  };
  await db.set(STORES.WORKOUTS, workout);
  await clearCurrentWorkout();
  stopWorkoutTimer();
  blastConfetti();
  showToast("Workout complete!");
  console.log("[workout] finish cleared");
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
  const lastVolume = last.totalVolumeKg ?? last.totalVolume ?? 0;
  dom.insightsList.innerHTML = `
    <li>Last workout: ${last.duration} min  -  ${last.totalSets} sets</li>
    <li>Total volume: ${lastVolume} kg</li>
    <li>XP earned: ${last.xp}</li>
  `;
};

const promptNumber = (label, currentValue) => {
  const input = prompt(`${label}`, String(currentValue ?? 0));
  if (input === null) return null;
  const value = Number(input);
  if (Number.isNaN(value)) {
    showToast("Enter a valid number.");
    return null;
  }
  return value;
};

const getWorkoutCalories = (workout) => {
  if (Number.isFinite(workout.caloriesBurned)) return workout.caloriesBurned;
  const volume = Number(workout.totalVolumeKg ?? workout.totalVolume) || 0;
  const durationSec = Number(workout.durationSec) || Number(workout.duration || 0) * 60;
  return calculateCaloriesBurned(volume, durationSec);
};

const renderHistoryDetailView = (workout) => {
  if (!dom.historyDetailModal || !dom.historyDetailContent) return;
  const calories = getWorkoutCalories(workout);
  const volume = Number(workout.totalVolumeKg ?? workout.totalVolume) || 0;
  const durationMin = Number(workout.duration) || Math.round((workout.durationSec || 0) / 60);
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const exerciseBlocks = exercises
    .map((exercise) => {
      const sets = (exercise.sets || [])
        .filter((set) => Number.isFinite(set.reps) && set.reps > 0 && Number.isFinite(set.weight) && set.weight >= 0)
        .map((set) => `<div class="history-set">${set.weight}kg x ${set.reps}</div>`)
        .join("");
      const notes = exercise.notes ? `<div class="history-notes">${exercise.notes}</div>` : "";
      return `
        <div class="history-exercise">
          <strong>${exercise.name}</strong>
          ${notes}
          <div class="history-sets">
            ${sets || '<div class="muted">No sets recorded.</div>'}
          </div>
        </div>
      `;
    })
    .join("");
  dom.historyDetailContent.innerHTML = `
    <div class="history-detail-header">
      <div>
        <h3>${new Date(workout.date).toLocaleDateString()}</h3>
        <div class="muted">${workout.day || "--"}  -  ${workout.split || "--"}</div>
      </div>
      <div class="history-detail-actions">
        <button class="chip" id="historyDetailEdit" type="button">Edit</button>
        <button class="chip" id="historyDetailClose" type="button">Close</button>
      </div>
    </div>
    <div class="history-detail-meta">
      <span>Duration: ${durationMin || 0} min</span>
      <span>Calories: ${calories} kcal</span>
      <span>Volume: ${volume} kg</span>
    </div>
    <div class="history-detail-body">
      ${exerciseBlocks || '<div class="muted">No exercises recorded.</div>'}
    </div>
  `;
  dom.historyDetailModal.classList.add("open");
  dom.historyDetailContent
    .querySelector("#historyDetailEdit")
    ?.addEventListener("click", () => renderHistoryDetailEdit(workout));
  dom.historyDetailContent
    .querySelector("#historyDetailClose")
    ?.addEventListener("click", closeHistoryDetail);
};

const readExerciseEdits = () => {
  const exercises = [];
  dom.historyDetailContent.querySelectorAll(".history-exercise-edit").forEach((exerciseEl) => {
    const name = exerciseEl.dataset.exerciseName || "";
    const notes = exerciseEl.querySelector(".history-edit-notes")?.value || "";
    const sets = [];
    exerciseEl.querySelectorAll(".history-set-edit").forEach((setEl) => {
      const weightValue = setEl.querySelector(".history-edit-weight")?.value;
      const repsValue = setEl.querySelector(".history-edit-reps")?.value;
      const weight = Number(weightValue);
      const reps = Number(repsValue);
      sets.push({
        weight: Number.isFinite(weight) ? weight : null,
        reps: Number.isFinite(reps) ? reps : null,
      });
    });
    exercises.push({ name, notes, sets });
  });
  return exercises;
};

const renderHistoryDetailEdit = (workout) => {
  if (!dom.historyDetailModal || !dom.historyDetailContent) return;
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const durationMin = Number(workout.duration) || Math.round((workout.durationSec || 0) / 60);
  const exerciseBlocks = exercises
    .map((exercise) => {
      const rawSets = exercise.sets && exercise.sets.length ? exercise.sets : [{ weight: null, reps: null }];
      const sets = rawSets
        .map(
          (set, setIndex) => `
        <div class="history-set-edit">
          <input
            class="field history-edit-weight"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.5"
            value="${set.weight ?? ""}"
            aria-label="Set ${setIndex + 1} weight"
          />
          <input
            class="field history-edit-reps"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            value="${set.reps ?? ""}"
            aria-label="Set ${setIndex + 1} reps"
          />
        </div>`
        )
        .join("");
      return `
        <div class="history-exercise history-exercise-edit" data-exercise-name="${exercise.name}">
          <strong>${exercise.name}</strong>
          <textarea class="field history-edit-notes" rows="2" placeholder="Notes">${exercise.notes || ""}</textarea>
          <div class="history-sets">${sets}</div>
        </div>
      `;
    })
    .join("");
  dom.historyDetailContent.innerHTML = `
    <div class="history-detail-header">
      <div>
        <h3>Edit ${new Date(workout.date).toLocaleDateString()}</h3>
        <div class="muted">${workout.day || "--"}  -  ${workout.split || "--"}</div>
      </div>
      <div class="history-detail-actions">
        <button class="chip" id="historyDetailCancel" type="button">Cancel</button>
        <button class="primary" id="historyDetailSave" type="button">Save</button>
      </div>
    </div>
    <div class="history-detail-meta">
      <label class="history-edit-row">
        <span>Duration (min)</span>
        <input class="field history-edit-duration" type="number" inputmode="numeric" min="1" step="1" value="${durationMin}" />
      </label>
      <label class="history-edit-row">
        <span>XP</span>
        <input class="field history-edit-xp" type="number" inputmode="numeric" min="0" step="1" value="${workout.xp ?? 0}" />
      </label>
    </div>
    <div class="history-detail-body">
      ${exerciseBlocks || '<div class="muted">No exercises recorded.</div>'}
    </div>
  `;
  dom.historyDetailModal.classList.add("open");
  dom.historyDetailContent
    .querySelector("#historyDetailCancel")
    ?.addEventListener("click", () => renderHistoryDetailView(workout));
  dom.historyDetailContent
    .querySelector("#historyDetailSave")
    ?.addEventListener("click", async () => {
      const exercisesUpdated = readExerciseEdits();
      const durationInput = dom.historyDetailContent.querySelector(".history-edit-duration");
      const xpInput = dom.historyDetailContent.querySelector(".history-edit-xp");
      const duration = Number(durationInput?.value);
      const durationSec = Math.max(1, Math.round((Number.isFinite(duration) ? duration : 1) * 60));
      const summary = calculateWorkoutSummary(exercisesUpdated);
      const caloriesBurned = calculateCaloriesBurned(summary.totalVolume, durationSec);
      const updated = {
        ...workout,
        duration: Math.max(1, Math.round(durationSec / 60)),
        durationSec,
        xp: Math.max(0, Number(xpInput?.value) || 0),
        exercisesCount: summary.exercisesCount,
        totalSets: summary.totalSets,
        totalReps: summary.totalReps,
        totalVolume: summary.totalVolume,
        totalVolumeKg: summary.totalVolume,
        caloriesBurned,
        exercises: exercisesUpdated,
      };
      await db.set(STORES.WORKOUTS, updated);
      showToast("Workout updated.");
      await refreshDashboard();
      await renderHistory();
      renderHistoryDetailView(updated);
    });
};

const openHistoryDetail = (workout) => {
  renderHistoryDetailView(workout);
};

const closeHistoryDetail = () => {
  dom.historyDetailModal?.classList.remove("open");
};

const editWorkoutEntry = async (workout) => {
  renderHistoryDetailEdit(workout);
};

const deleteWorkoutEntry = async (workout) => {
  if (!confirm("Delete this workout?")) return;
  await db.delete(STORES.WORKOUTS, workout.id);
  showToast("Workout deleted.");
  await refreshDashboard();
  await renderHistory();
};

const renderHistory = async () => {
  const workouts = await db.getAll(STORES.WORKOUTS);
  dom.historyList.innerHTML = "";
  workouts.slice().reverse().forEach((workout) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-item-header">
        <strong>${new Date(workout.date).toLocaleDateString()}</strong>
        <div class="history-entry-actions">
          <button class="chip danger history-delete" type="button" aria-label="Delete workout">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="history-delete-icon">
              <path
                d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1h4v2h-2l-1.2 12.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8H4V6h4zm2 0h4V5h-4v1zm0 5v7h2v-7h-2zm4 0v7h2v-7h-2z"
              />
            </svg>
            <span class="history-delete-text">Delete</span>
          </button>
        </div>
      </div>
      <span class="muted">${workout.day}  -  ${workout.duration} min  -  ${workout.xp} XP</span>
      <span class="muted">${workout.exercisesCount} exercises  -  ${workout.totalSets} sets  -  ${
      workout.totalVolumeKg ?? workout.totalVolume
    } kg</span>
    `;
    item.addEventListener("click", () => openHistoryDetail(workout));
    item.querySelector(".history-delete").addEventListener("click", (event) => {
      event.stopPropagation();
      void deleteWorkoutEntry(workout);
    });
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
  console.log("[workout] load currentWorkout", settings.currentWorkout);
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
    const storedStartTime = settings.currentWorkout.startTime;
    console.log("[workout] storedStartTime", storedStartTime);
    state.pendingElapsedMs = Date.now() - storedStartTime;
    state.awaitingResume = true;
    console.log("[workout] pausedElapsedMs", state.pendingElapsedMs);
    updateWorkoutTimer();
    await openResumePrompt();
  } else {
    state.workoutStart = null;
    state.awaitingResume = false;
    state.pendingElapsedMs = 0;
    updateWorkoutTimer();
    dom.resumeModal?.classList.remove("open");
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
  if (state.workoutStart) return;
  state.awaitingResume = false;
  state.pendingElapsedMs = 0;
  state.workoutStart = Date.now();
  console.log("[workout] start", state.workoutStart);
  startWorkoutTimer();
  showToast("Workout started.");
  try {
    const settings = await db.get(STORES.SETTINGS, "settings");
    await db.set(STORES.SETTINGS, {
      ...settings,
      key: "settings",
      currentWorkout: { startTime: state.workoutStart, split: state.split, day: state.day },
    });
    await updateWorkoutState();
  } catch (error) {
    console.error("[workout] failed to persist start", error);
  }
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

dom.resumeContinueBtn?.addEventListener("click", resumeWorkout);

dom.resumeDiscardBtn?.addEventListener("click", async () => {
  await resetWorkout();
});

dom.updateBtn.addEventListener("click", () => {
  window.location.reload();
});

dom.historyDetailModal?.addEventListener("click", (event) => {
  if (event.target === dom.historyDetailModal) {
    closeHistoryDetail();
  }
});

window.addEventListener("visibilitychange", () => {
  if (document.hidden) {
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
    updateWorkoutTimer();
    if (state.workoutStart && !state.workoutTimerId && !state.resumePromptOpen) {
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










