import { db, ensureAnonAuth } from "./firebase.js";
import {
  doc,
  collection,
  onSnapshot,
  updateDoc,
  runTransaction,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const roomTitle = document.getElementById("roomTitle");
const roomCodeTitle = document.getElementById("roomCodeTitle");
const roomStatus = document.getElementById("roomStatus");
const scoreboard = document.getElementById("scoreboard");
const playerList = document.getElementById("playerList");
const timerDisplay = document.getElementById("timerDisplay");
const questionText = document.getElementById("questionText");
const buzzBtn = document.getElementById("buzzBtn");
const buzzStatus = document.getElementById("buzzStatus");

const startTossupBtn = document.getElementById("startTossupBtn");
const tossupCorrectBtn = document.getElementById("tossupCorrectBtn");
const tossupWrongBtn = document.getElementById("tossupWrongBtn");
const startBonusBtn = document.getElementById("startBonusBtn");
const bonusCorrectBtn = document.getElementById("bonusCorrectBtn");
const bonusWrongBtn = document.getElementById("bonusWrongBtn");
const nextTossupBtn = document.getElementById("nextTossupBtn");
const hostNote = document.getElementById("hostNote");

let activeRoomId = null;
let roomUnsub = null;
let playerUnsub = null;
let timerInterval = null;

const state = {
  uid: null,
  team: "A",
  name: "Player",
  isHost: false
};

function getRoomId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("roomId");
}

async function ensureIdentity() {
  const user = await ensureAnonAuth();
  state.uid = user.uid;
  const cached = localStorage.getItem("atom_buzzer_profile");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      state.name = parsed.name || state.name;
      state.team = parsed.team || state.team;
    } catch {}
  }
}

function setHostVisible(isHost) {
  document.querySelectorAll(".host-only").forEach((el) => {
    el.style.display = isHost ? "block" : "none";
  });
}

function humanStatus(data) {
  const status = data.status || "lobby";
  if (status === "lobby") return "Waiting for host.";
  if (status === "tossup_reading") return "Tossup live. Buzz now.";
  if (status === "tossup_answering") return "Tossup answering.";
  if (status === "bonus_reading") return "Bonus ready.";
  if (status === "bonus_answering") return "Bonus answering.";
  if (status === "ended") return "Game ended.";
  return status;
}

function updateBuzzStatus(data) {
  const buzz = data.currentBuzz;
  if (!buzz) {
    buzzStatus.textContent = "Waiting...";
    return;
  }
  buzzStatus.textContent = `Buzzed: ${buzz.team || "?"}`;
}

function updateScores(scores, teamCount) {
  scoreboard.innerHTML = "";
  const keys = Object.keys(scores || {});
  const teams = keys.length ? keys : Array.from({ length: teamCount }, (_, i) => String.fromCharCode(65 + i));
  teams.forEach((team) => {
    const scoreCard = document.createElement("div");
    scoreCard.className = "score";
    const label = document.createElement("span");
    label.textContent = `Team ${team}`;
    const value = document.createElement("strong");
    value.textContent = scores?.[team] ?? 0;
    scoreCard.appendChild(label);
    scoreCard.appendChild(value);
    scoreboard.appendChild(scoreCard);
  });
}

function updateTimer(data) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timers = data.timers;
  if (!timers || !timers.phaseEndAt) {
    timerDisplay.textContent = "--:--";
    return;
  }
  const end = timers.phaseEndAt;
  const tick = () => {
    const remainingMs = Math.max(0, end - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const secs = String(totalSeconds % 60).padStart(2, "0");
    timerDisplay.textContent = `${mins}:${secs}`;
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

function updateHostNote(data) {
  if (!state.isHost) return;
  const status = data.status || "lobby";
  if (status === "lobby") {
    hostNote.textContent = "Start the first tossup timer when ready.";
  } else if (status === "tossup_reading") {
    hostNote.textContent = "Waiting for buzz.";
  } else if (status === "tossup_answering") {
    hostNote.textContent = "Grade the tossup.";
  } else if (status === "bonus_reading") {
    hostNote.textContent = "Start the bonus timer.";
  } else if (status === "bonus_answering") {
    hostNote.textContent = "Grade the bonus.";
  } else {
    hostNote.textContent = "";
  }
}

function renderPlayers(players) {
  playerList.innerHTML = "";
  const sorted = players.sort((a, b) => (a.team || "").localeCompare(b.team || ""));
  sorted.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    const left = document.createElement("span");
    left.textContent = p.name || "Player";
    const right = document.createElement("span");
    right.textContent = `${p.team || "?"}${p.isHost ? " · Host" : ""}`;
    card.appendChild(left);
    card.appendChild(right);
    playerList.appendChild(card);
  });
}

async function enterRoom(roomId) {
  activeRoomId = roomId;
  if (roomUnsub) roomUnsub();
  if (playerUnsub) playerUnsub();

  roomUnsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
    const data = snap.data();
    if (!data) return;
    roomTitle.textContent = data.roomName || `Room ${data.roomCode}`;
    roomCodeTitle.textContent = `Room ${data.roomCode}`;
    roomStatus.textContent = humanStatus(data);
    updateScores(data.scores || {}, data.settings?.teamCount || 2);
    updateBuzzStatus(data);
    updateTimer(data);
    updateHostNote(data);
    setHostVisible(data.hostUid === state.uid);
    if (data.status === "lobby") {
      questionText.textContent = "Waiting for host.";
    }
  });

  playerUnsub = onSnapshot(collection(db, "rooms", roomId, "players"), (snap) => {
    const list = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderPlayers(list);
  });
}

async function withRoomDoc() {
  if (!activeRoomId) throw new Error("No room joined.");
  const ref = doc(db, "rooms", activeRoomId);
  const snap = await getDoc(ref);
  return { ref, data: snap.data() };
}

async function startTossup() {
  const { ref, data } = await withRoomDoc();
  if (!data) return;
  const tuTime = data.settings?.tuTime || 5;
  await updateDoc(ref, {
    status: "tossup_reading",
    currentBuzz: null,
    timers: { phaseEndAt: Date.now() + tuTime * 1000, phaseDuration: tuTime },
    lastAction: { type: "start_tossup", at: Date.now(), by: state.uid }
  });
}

async function startBonusTimer() {
  const { ref, data } = await withRoomDoc();
  if (!data) return;
  const bonusTime = data.settings?.bonusTime || 20;
  await updateDoc(ref, {
    status: "bonus_answering",
    timers: { phaseEndAt: Date.now() + bonusTime * 1000, phaseDuration: bonusTime },
    lastAction: { type: "start_bonus", at: Date.now(), by: state.uid }
  });
}

async function gradeTossup(correct) {
  const { ref, data } = await withRoomDoc();
  if (!data) return;
  const buzz = data.currentBuzz;
  const scores = { ...(data.scores || {}) };
  if (buzz && correct) {
    scores[buzz.team] = (scores[buzz.team] || 0) + 4;
  }
  if (buzz && !correct) {
    scores[buzz.team] = (scores[buzz.team] || 0) - 4;
  }
  await updateDoc(ref, {
    scores,
    status: "tossup_reading",
    currentBuzz: null,
    timers: null,
    lastAction: { type: `tossup_${correct ? "correct" : "wrong"}`, at: Date.now(), by: state.uid }
  });
}

async function gradeBonus(correct) {
  const { ref, data } = await withRoomDoc();
  if (!data) return;
  const scores = { ...(data.scores || {}) };
  const buzz = data.currentBuzz;
  if (correct && buzz) {
    scores[buzz.team] = (scores[buzz.team] || 0) + 10;
  }
  await updateDoc(ref, {
    scores,
    status: "tossup_reading",
    currentBuzz: null,
    timers: null,
    lastAction: { type: `bonus_${correct ? "correct" : "wrong"}`, at: Date.now(), by: state.uid }
  });
}

async function nextTossup() {
  const { ref } = await withRoomDoc();
  await updateDoc(ref, {
    status: "tossup_reading",
    currentBuzz: null,
    timers: null,
    lastAction: { type: "next_tossup", at: Date.now(), by: state.uid }
  });
}

async function buzz() {
  if (!activeRoomId) return;
  const roomRef = doc(db, "rooms", activeRoomId);
  try {
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(roomRef);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== "tossup_reading") return;
      if (data.currentBuzz) return;
      const tuTime = data.settings?.tuTime || 5;
      txn.update(roomRef, {
        currentBuzz: { uid: state.uid, team: state.team, at: Date.now() },
        status: "tossup_answering",
        timers: { phaseEndAt: Date.now() + tuTime * 1000, phaseDuration: tuTime },
        lastAction: { type: "buzz", at: Date.now(), by: state.uid }
      });
    });
  } catch (err) {
    console.error("Buzz failed", err);
  }
}

startTossupBtn.addEventListener("click", startTossup);
tossupCorrectBtn.addEventListener("click", () => gradeTossup(true));
tossupWrongBtn.addEventListener("click", () => gradeTossup(false));
startBonusBtn.addEventListener("click", startBonusTimer);
bonusCorrectBtn.addEventListener("click", () => gradeBonus(true));
bonusWrongBtn.addEventListener("click", () => gradeBonus(false));
nextTossupBtn.addEventListener("click", nextTossup);
buzzBtn.addEventListener("click", buzz);

(async () => {
  await ensureIdentity();
  const roomId = getRoomId();
  if (!roomId) {
    roomStatus.textContent = "Missing room ID.";
    return;
  }
  await enterRoom(roomId);
})();
