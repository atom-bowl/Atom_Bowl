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
const scoreboardHeader = document.getElementById("scoreboardHeader");
const scoreboardPanel = document.getElementById("scoreboardPanel");
const playerList = document.getElementById("playerList");
const statsTableBody = document.getElementById("statsTableBody");
const questionText = document.getElementById("questionText");
const buzzBtn = document.getElementById("buzzBtn");
const buzzStatus = document.getElementById("buzzStatus");
const statusPill = document.getElementById("statusPill");
const logPanel = document.getElementById("logPanel");
const roomCodeValue = document.getElementById("roomCodeValue");
const copyRoomBtn = document.getElementById("copyRoomBtn");
const joinAsPlayerBtn = document.getElementById("joinAsPlayerBtn");
const playerPhaseTimer = document.getElementById("playerPhaseTimer");
const playerGameClock = document.getElementById("playerGameClock");
const toggleLogBtn = document.getElementById("toggleLogBtn");
const playerLogPanel = document.getElementById("playerLogPanel");

const gameClockDisplay = document.getElementById("gameClockDisplay");
const tossupTimerDisplay = document.getElementById("tossupTimerDisplay");
const bonusTimerDisplay = document.getElementById("bonusTimerDisplay");
const gameStartBtn = document.getElementById("gameStartBtn");
const gamePauseBtn = document.getElementById("gamePauseBtn");
const gameResetBtn = document.getElementById("gameResetBtn");

const startTossupBtn = document.getElementById("startTossupBtn");
const tossupCategory = document.getElementById("tossupCategory");
const tossupInterruptBtn = document.getElementById("tossupInterruptBtn");
const tossupCorrectBtn = document.getElementById("tossupCorrectBtn");
const tossupWrongBtn = document.getElementById("tossupWrongBtn");
const startBonusBtn = document.getElementById("startBonusBtn");
const bonusCorrectBtn = document.getElementById("bonusCorrectBtn");
const bonusWrongBtn = document.getElementById("bonusWrongBtn");
const nextTossupBtn = document.getElementById("nextTossupBtn");
const bonusTeamSelect = document.getElementById("bonusTeamSelect");
const exportBtn = document.getElementById("exportBtn");
const hostNote = document.getElementById("hostNote");

let activeRoomId = null;
let roomUnsub = null;
let playerUnsub = null;
let timerInterval = null;
let gameClockInterval = null;
let cachedRoom = null;
let activeRoomCode = "";
let latestPlayers = [];

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
  state.isHost = isHost;
  const role = localStorage.getItem("atom_buzzer_role");
  const allowHost = role === "host";
  const effectiveHost = isHost && allowHost;
  if (isHost) {
    localStorage.setItem("atom_buzzer_role", "host");
  }
  document.body.classList.toggle("is-host", effectiveHost);
  document.body.classList.toggle("is-player", !effectiveHost);
  state.isHost = effectiveHost;
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function humanStatus(status) {
  if (status === "lobby") return "Waiting for host.";
  if (status === "tossup_open") return "Tossup open. Anyone can buzz.";
  if (status === "tossup_locked") return "Locked — host grading.";
  if (status === "bonus_ready") return "Bonus ready — select team and start.";
  if (status === "bonus_open") return "Bonus open — selected team can buzz.";
  if (status === "bonus_locked") return "Bonus locked — host grading.";
  if (status === "ended") return "Game ended.";
  return status || "Waiting.";
}

function updateStatusUI(data) {
  roomStatus.textContent = humanStatus(data.status);
  const isOpen = data.status?.includes("open");
  statusPill.textContent = isOpen ? "OPEN" : "LOCKED";
  statusPill.classList.toggle("open", isOpen);
  statusPill.classList.toggle("locked", !isOpen);
  questionText.textContent = humanStatus(data.status);
  updateBuzzButtonState(data);
}

function updateBuzzButtonState(data) {
  if (!buzzBtn) return;
  const isOpen = data.status === "tossup_open" || data.status === "bonus_open";
  let canBuzz = isOpen;
  if (data.status === "bonus_open" && data.bonusTeam && data.bonusTeam !== state.team) {
    canBuzz = false;
  }
  if (data.status === "tossup_open" && data.lockoutTeam && data.lockoutTeam === state.team) {
    canBuzz = false;
  }
  buzzBtn.disabled = !canBuzz;
  buzzBtn.classList.toggle("buzz-locked", !canBuzz);
}

function updateBuzzStatus(data) {
  const buzz = data.currentBuzz;
  if (!buzz) {
    buzzStatus.textContent = "Waiting...";
    return;
  }
  buzzStatus.textContent = `Buzzed: ${buzz.team || "?"}`;
}

function updateScores(scores, teamCount, teamNames) {
  const targets = [scoreboardHeader].filter(Boolean);
  targets.forEach((el) => {
    el.innerHTML = "";
  });
  const keys = Object.keys(scores || {});
  const teams = keys.length ? keys : Array.from({ length: teamCount }, (_, i) => String.fromCharCode(65 + i));
  teams.forEach((team) => {
    const scoreCard = document.createElement("div");
    scoreCard.className = "score";
    const label = document.createElement("span");
    label.textContent = teamNames?.[team] || `Team ${team}`;
    const value = document.createElement("strong");
    value.textContent = scores?.[team] ?? 0;
    scoreCard.appendChild(label);
    scoreCard.appendChild(value);
    targets.forEach((el) => el.appendChild(scoreCard.cloneNode(true)));
  });
}

function updatePlayerScoreboard(stats, players = latestPlayers) {
  if (!scoreboardPanel) return;
  scoreboardPanel.innerHTML = "";
  const statsPlayers = stats?.player || {};
  const merged = (players || []).map((p) => {
    const stat = statsPlayers[p.id] || {};
    return {
      name: p.name || stat.name || "Player",
      team: p.team || stat.team || "?",
      points: stat.points ?? 0
    };
  });
  merged.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  merged.forEach((player) => {
    const card = document.createElement("div");
    card.className = "score";
    const label = document.createElement("span");
    label.textContent = `${player.name || "Player"} (${player.team || "?"})`;
    const value = document.createElement("strong");
    value.textContent = player.points ?? 0;
    card.appendChild(label);
    card.appendChild(value);
    scoreboardPanel.appendChild(card);
  });
}

function updatePlayerStats(stats) {
  statsTableBody.innerHTML = "";
  const entries = Object.entries(stats?.player || {});
  entries.sort((a, b) => (a[1].name || "").localeCompare(b[1].name || ""));
  entries.forEach(([uid, data]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${data.name || uid.slice(0, 6)}</td>
      <td>${data.team || "?"}</td>
      <td>${data.correct || 0}</td>
      <td>${data.incorrect || 0}</td>
      <td>${data.interrupt || 0}</td>
      <td>${data.buzzes || 0}</td>
    `;
    statsTableBody.appendChild(row);
  });
}

function updateLog(log) {
  logPanel.innerHTML = "";
  const entries = (log || []).slice().reverse();
  entries.forEach((item) => {
    const div = document.createElement("div");
    div.className = "log-item";
    const time = new Date(item.at || Date.now()).toLocaleTimeString();
    div.textContent = `[${time}] ${item.details || item.type}`;
    logPanel.appendChild(div);
  });

  if (playerLogPanel) {
    playerLogPanel.innerHTML = "";
    entries.forEach((item) => {
      const div = document.createElement("div");
      div.className = "log-item";
      const time = new Date(item.at || Date.now()).toLocaleTimeString();
      div.textContent = `[${time}] ${item.details || item.type}`;
      playerLogPanel.appendChild(div);
    });
  }
}

function updateTimers(data) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timers = data.timers;
  if (!timers || !timers.phaseEndAt) {
    const tuDefault = formatTime((data.settings?.tuTime || 5) * 1000);
    const bonusDefault = formatTime((data.settings?.bonusTime || 20) * 1000);
    tossupTimerDisplay.textContent = tuDefault;
    bonusTimerDisplay.textContent = bonusDefault;
    if (playerPhaseTimer) playerPhaseTimer.textContent = tuDefault;
    return;
  }
  const end = timers.phaseEndAt;
  const target = timers.phaseType === "bonus" ? bonusTimerDisplay : tossupTimerDisplay;
  const tick = () => {
    const remaining = end - Date.now();
    const formatted = formatTime(remaining);
    target.textContent = formatted;
    if (playerPhaseTimer) playerPhaseTimer.textContent = formatted;
    if (remaining <= 0 && state.isHost && data.status === "bonus_open") {
      expireBonusTimer().catch(() => {});
    }
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

function renderGameClock(data) {
  if (gameClockInterval) {
    clearInterval(gameClockInterval);
    gameClockInterval = null;
  }
  const clock = data.gameClock || { status: "stopped", remainingMs: 180000, updatedAt: Date.now() };
  const tick = () => {
    const delta = clock.status === "running" ? Date.now() - clock.updatedAt : 0;
    const remaining = Math.max(0, clock.remainingMs - delta);
    const formatted = formatTime(remaining);
    gameClockDisplay.textContent = formatted;
    if (playerGameClock) playerGameClock.textContent = formatted;
  };
  tick();
  gameClockInterval = setInterval(tick, 250);
}

function buildBonusTeamOptions(teamCount, teamNames) {
  bonusTeamSelect.innerHTML = "";
  for (let i = 0; i < teamCount; i += 1) {
    const team = String.fromCharCode(65 + i);
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = teamNames?.[team] || `Team ${team}`;
    bonusTeamSelect.appendChild(opt);
  }
}

function updateHostNote(data) {
  if (!state.isHost) return;
  hostNote.textContent = humanStatus(data.status);
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
  roomStatus.textContent = "Loading room...";

  roomUnsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
    if (!snap.exists()) {
      roomStatus.textContent = "Room not found.";
      if (roomCodeValue) roomCodeValue.textContent = "-----";
      return;
    }
    const data = snap.data();
    cachedRoom = data;
    roomTitle.textContent = data.roomName || `Room ${data.roomCode}`;
    roomCodeTitle.textContent = `Room ${data.roomCode}`;
    activeRoomCode = data.roomCode || "";
    if (roomCodeValue) roomCodeValue.textContent = data.roomCode || "-----";
    updateStatusUI(data);
    updateScores(data.scores || {}, data.settings?.teamCount || 2, data.settings?.teamNames || {});
    updateBuzzStatus(data);
    updateTimers(data);
    renderGameClock(data);
    updateHostNote(data);
    updateLog(data.log || []);
    updatePlayerStats(data.stats || {});
    updatePlayerScoreboard(data.stats || {});
    buildBonusTeamOptions(data.settings?.teamCount || 2, data.settings?.teamNames || {});
    if (data.bonusTeam) bonusTeamSelect.value = data.bonusTeam;
    setHostVisible(data.hostUid === state.uid);
  }, (err) => {
    console.error("Room snapshot error", err);
    roomStatus.textContent = "Room unavailable (check permissions).";
  });

  playerUnsub = onSnapshot(collection(db, "rooms", roomId, "players"), (snap) => {
    const list = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    latestPlayers = list;
    renderPlayers(list);
    updatePlayerScoreboard(cachedRoom?.stats || {}, list);
  });
}

async function withRoomDoc() {
  if (!activeRoomId) throw new Error("No room joined.");
  const ref = doc(db, "rooms", activeRoomId);
  const snap = await getDoc(ref);
  return { ref, data: snap.data() };
}

async function expireBonusTimer() {
  const { ref, data } = await withRoomDoc();
  if (!data || data.status !== "bonus_open") return;
  await updateDoc(ref, {
    status: "bonus_locked",
    timers: null,
    lastAction: { type: "bonus_expired", at: Date.now(), by: state.uid },
    log: appendLog(data, { type: "bonus_expired", at: Date.now(), by: state.uid, details: "Bonus timer expired" })
  });
}

function appendLog(data, entry) {
  const next = [...(data.log || []), entry];
  return next.slice(-200);
}

function updateStatsForBuzz(stats, buzz) {
  const next = { ...(stats || {}), team: { ...(stats?.team || {}) }, player: { ...(stats?.player || {}) } };
  if (!buzz) return next;
  const teamStats = next.team[buzz.team] || { correct: 0, incorrect: 0, interrupt: 0, buzzes: 0 };
  teamStats.buzzes += 1;
  next.team[buzz.team] = teamStats;

  const player = next.player[buzz.uid] || { name: buzz.name || "Player", team: buzz.team, correct: 0, incorrect: 0, interrupt: 0, buzzes: 0, points: 0 };
  player.buzzes += 1;
  next.player[buzz.uid] = player;
  return next;
}

function updateStatsForGrade(stats, buzz, kind, pointsDelta) {
  const next = { ...(stats || {}), team: { ...(stats?.team || {}) }, player: { ...(stats?.player || {}) } };
  if (!buzz) return next;
  const teamStats = next.team[buzz.team] || { correct: 0, incorrect: 0, interrupt: 0, buzzes: 0 };
  const player = next.player[buzz.uid] || { name: buzz.name || "Player", team: buzz.team, correct: 0, incorrect: 0, interrupt: 0, buzzes: 0, points: 0 };
  teamStats[kind] = (teamStats[kind] || 0) + 1;
  player[kind] = (player[kind] || 0) + 1;
  if (typeof pointsDelta === "number") {
    player.points = (player.points || 0) + pointsDelta;
  }
  next.team[buzz.team] = teamStats;
  next.player[buzz.uid] = player;
  return next;
}

async function startTossup() {
  const { ref, data } = await withRoomDoc();
  const tuTime = data.settings?.tuTime || 5;
  const category = tossupCategory?.value || "General";
  await updateDoc(ref, {
    status: "tossup_open",
    currentBuzz: null,
    lockoutTeam: null,
    currentCategory: category,
    timers: { phaseEndAt: Date.now() + tuTime * 1000, phaseDuration: tuTime, phaseType: "tossup" },
    lastAction: { type: "tossup_start", at: Date.now(), by: state.uid },
    log: appendLog(data, { type: "tossup_start", at: Date.now(), by: state.uid, details: `Tossup (TU) in ${category} opened` })
  });
}

async function startBonusTimer() {
  const { ref, data } = await withRoomDoc();
  const bonusTime = data.settings?.bonusTime || 20;
  const category = data.currentCategory || tossupCategory?.value || "General";
  await updateDoc(ref, {
    status: "bonus_open",
    timers: { phaseEndAt: Date.now() + bonusTime * 1000, phaseDuration: bonusTime, phaseType: "bonus" },
    bonusTeam: bonusTeamSelect.value || data.bonusTeam || "A",
    lockoutTeam: null,
    currentCategory: category,
    lastAction: { type: "bonus_start", at: Date.now(), by: state.uid },
    log: appendLog(data, { type: "bonus_start", at: Date.now(), by: state.uid, team: bonusTeamSelect.value, details: `Bonus opened (${category})` })
  });
}

async function gradeTossup(kind) {
  const { ref, data } = await withRoomDoc();
  const buzz = data.currentBuzz;
  const scores = { ...(data.scores || {}) };
  let pointsDelta = 0;
  if (buzz) {
    if (kind === "correct") {
      scores[buzz.team] = (scores[buzz.team] || 0) + 4;
      pointsDelta = 4;
    }
    if (kind === "incorrect") {
      scores[buzz.team] = (scores[buzz.team] || 0) - 4;
      pointsDelta = -4;
    }
    if (kind === "interrupt") {
      scores[buzz.team] = (scores[buzz.team] || 0) - 4;
      pointsDelta = -4;
    }
  }
  const stats = updateStatsForGrade(data.stats, buzz, kind === "interrupt" ? "interrupt" : kind, pointsDelta);
  await updateDoc(ref, {
    scores,
    stats,
    status: kind === "correct" ? "bonus_ready" : "tossup_open",
    currentBuzz: null,
    lockoutTeam: kind === "correct" ? null : buzz?.team || null,
    timers: null,
    lastAction: { type: `tossup_${kind}`, at: Date.now(), by: state.uid },
    log: appendLog(data, { type: `tossup_${kind}`, at: Date.now(), by: state.uid, team: buzz?.team, details: `Tossup ${kind}` })
  });
}

async function gradeBonus(correct) {
  const { ref, data } = await withRoomDoc();
  const buzz = data.currentBuzz;
  const scores = { ...(data.scores || {}) };
  const pointsDelta = correct && buzz ? 10 : 0;
  if (correct && buzz) scores[buzz.team] = (scores[buzz.team] || 0) + 10;
  const stats = updateStatsForGrade(data.stats, buzz, correct ? "correct" : "incorrect", pointsDelta);
  await updateDoc(ref, {
    scores,
    stats,
    status: "tossup_open",
    currentBuzz: null,
    lockoutTeam: null,
    timers: null,
    lastAction: { type: `bonus_${correct ? "correct" : "wrong"}`, at: Date.now(), by: state.uid },
    log: appendLog(data, { type: `bonus_${correct ? "correct" : "wrong"}`, at: Date.now(), by: state.uid, team: buzz?.team, details: `Bonus ${correct ? "correct" : "wrong"}` })
  });
}

async function nextTossup() {
  const { ref, data } = await withRoomDoc();
  await updateDoc(ref, {
    status: "tossup_open",
    currentBuzz: null,
    lockoutTeam: null,
    timers: null,
    lastAction: { type: "next_tossup", at: Date.now(), by: state.uid },
    log: appendLog(data, { type: "next_tossup", at: Date.now(), by: state.uid, details: "Opened next tossup" })
  });
}

async function buzz() {
  if (state.isHost) return;
  if (!activeRoomId) return;
  const roomRef = doc(db, "rooms", activeRoomId);
  try {
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(roomRef);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== "tossup_open" && data.status !== "bonus_open") return;
      if (data.currentBuzz) return;
      if (data.status === "bonus_open" && data.bonusTeam && data.bonusTeam !== state.team) return;
      if (data.status === "tossup_open" && data.lockoutTeam && data.lockoutTeam === state.team) return;
      const buzzData = { uid: state.uid, team: state.team, at: Date.now(), name: state.name };
      const stats = updateStatsForBuzz(data.stats, buzzData);
      const newStatus = data.status === "bonus_open" ? "bonus_locked" : "tossup_locked";
      txn.update(roomRef, {
        currentBuzz: buzzData,
        status: newStatus,
        lastAction: { type: "buzz", at: Date.now(), by: state.uid },
        log: appendLog(data, { type: "buzz", at: Date.now(), by: state.uid, team: state.team, details: `Buzzed ${state.team}` }),
        stats
      });
    });
  } catch (err) {
    console.error("Buzz failed", err);
  }
}

async function updateGameClockAction(action) {
  const { ref, data } = await withRoomDoc();
  const clock = data.gameClock || { status: "stopped", remainingMs: 180000, updatedAt: Date.now() };
  let next = { ...clock };
  if (action === "start") {
    next = { status: "running", remainingMs: clock.remainingMs, updatedAt: Date.now() };
  } else if (action === "pause") {
    const elapsed = clock.status === "running" ? Date.now() - clock.updatedAt : 0;
    next = { status: "paused", remainingMs: Math.max(0, clock.remainingMs - elapsed), updatedAt: Date.now() };
  } else if (action === "reset") {
    next = { status: "stopped", remainingMs: 180000, updatedAt: Date.now() };
  }
  await updateDoc(ref, {
    gameClock: next,
    log: appendLog(data, { type: `game_${action}`, at: Date.now(), by: state.uid, details: `Game clock ${action}` })
  });
}

function exportCsv() {
  if (!cachedRoom) return;
  const lines = [];
  const teamNames = cachedRoom.settings?.teamNames || {};
  lines.push("Team,Score,Correct,Incorrect,Interrupt,Buzzes");
  Object.entries(cachedRoom.scores || {}).forEach(([team, score]) => {
    const stats = cachedRoom.stats?.team?.[team] || {};
    lines.push([
      teamNames[team] || `Team ${team}`,
      score,
      stats.correct || 0,
      stats.incorrect || 0,
      stats.interrupt || 0,
      stats.buzzes || 0
    ].join(","));
  });
  lines.push("");
  lines.push("Player,Team,Correct,Incorrect,Interrupt,Buzzes");
  Object.values(cachedRoom.stats?.player || {}).forEach((p) => {
    lines.push([p.name, p.team, p.correct || 0, p.incorrect || 0, p.interrupt || 0, p.buzzes || 0].join(","));
  });
  lines.push("");
  lines.push("Log");
  (cachedRoom.log || []).forEach((item) => {
    lines.push(`${new Date(item.at || Date.now()).toISOString()} - ${item.details || item.type}`);
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "atom-bowl-room.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function handleSpacebar(e) {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.code === "Space") {
    e.preventDefault();
    buzz();
  }
}

startTossupBtn.addEventListener("click", () => startTossup().catch(console.error));
tossupInterruptBtn.addEventListener("click", () => gradeTossup("interrupt").catch(console.error));
tossupCorrectBtn.addEventListener("click", () => gradeTossup("correct").catch(console.error));
tossupWrongBtn.addEventListener("click", () => gradeTossup("incorrect").catch(console.error));
startBonusBtn.addEventListener("click", () => startBonusTimer().catch(console.error));
bonusCorrectBtn.addEventListener("click", () => gradeBonus(true).catch(console.error));
bonusWrongBtn.addEventListener("click", () => gradeBonus(false).catch(console.error));
nextTossupBtn.addEventListener("click", () => nextTossup().catch(console.error));
buzzBtn.addEventListener("click", buzz);
bonusTeamSelect.addEventListener("change", async () => {
  const { ref } = await withRoomDoc();
  await updateDoc(ref, { bonusTeam: bonusTeamSelect.value });
});
gameStartBtn.addEventListener("click", () => updateGameClockAction("start").catch(console.error));
gamePauseBtn.addEventListener("click", () => updateGameClockAction("pause").catch(console.error));
gameResetBtn.addEventListener("click", () => updateGameClockAction("reset").catch(console.error));
exportBtn.addEventListener("click", exportCsv);
document.addEventListener("keydown", handleSpacebar);
if (copyRoomBtn) {
  copyRoomBtn.addEventListener("click", async () => {
    if (!activeRoomId) return;
    const roomCode = activeRoomCode || "Code";
    const joinLink = `https://atom-bowl.github.io/Atom_Bowl/buzzer_room_player.html?roomId=${activeRoomId}`;
    const text = [
      "You have been invited to an Atom Bowl Buzzing Room.",
      "Here is the link to join: https://atom-bowl.github.io/Atom_Bowl/buzzer-rooms.html",
      `and the code: "${roomCode}"`,
      `and a direct link: ${joinLink}`
    ].join(" ");
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {}
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        copied = document.execCommand("copy");
      } catch {}
      textarea.remove();
    }
    if (copied) {
      copyRoomBtn.textContent = "Copied!";
      setTimeout(() => {
        copyRoomBtn.textContent = "Copy Invite";
      }, 1500);
    } else {
      window.prompt("Copy this invite message:", text);
    }
  });
}
if (joinAsPlayerBtn) {
  joinAsPlayerBtn.addEventListener("click", () => {
    if (!activeRoomId) return;
    localStorage.setItem("atom_buzzer_role", "player");
    const joinLink = `buzzer_room_player.html?roomId=${activeRoomId}`;
    window.open(joinLink, "_blank");
  });
}
if (toggleLogBtn && playerLogPanel) {
  toggleLogBtn.addEventListener("click", () => {
    const isHidden = playerLogPanel.classList.contains("hidden");
    playerLogPanel.classList.toggle("hidden", !isHidden);
    toggleLogBtn.textContent = isHidden ? "Hide Buzz Log" : "Show Buzz Log";
  });
}

(async () => {
  await ensureIdentity();
  const roomId = getRoomId();
  if (!roomId) {
    roomStatus.textContent = "Missing room ID.";
    return;
  }
  await enterRoom(roomId);
})();
