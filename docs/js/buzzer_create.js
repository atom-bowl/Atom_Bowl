import { db, ensureAnonAuth } from "./firebase.js";
import {
  doc,
  collection,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const roomNameInput = document.getElementById("roomName");
const hostNameInput = document.getElementById("hostName");
const teamCountSelect = document.getElementById("teamCount");
const teamNameFields = document.getElementById("teamNameFields");
const hostTeamSelect = document.getElementById("hostTeam");
const nsbRulesCheckbox = document.getElementById("nsbRules");
const advancedSettings = document.getElementById("advancedSettings");
const tuTimeInput = document.getElementById("tuTime");
const bonusTimeInput = document.getElementById("bonusTime");
const createRoomBtn = document.getElementById("createRoomBtn");
const createError = document.getElementById("createError");

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildTeamNameFields(count) {
  teamNameFields.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const team = String.fromCharCode(65 + i);
    const label = document.createElement("label");
    label.className = "label";
    label.textContent = `Team ${team} Name`;
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 20;
    input.value = `Team ${team}`;
    input.dataset.team = team;
    teamNameFields.appendChild(label);
    teamNameFields.appendChild(input);
  }
}

function getTeamNamesFromInputs() {
  const names = {};
  const inputs = teamNameFields.querySelectorAll("input[data-team]");
  inputs.forEach((input) => {
    names[input.dataset.team] = input.value.trim() || `Team ${input.dataset.team}`;
  });
  return names;
}

function buildHostTeamOptions(count, teamNames = {}) {
  hostTeamSelect.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    const team = String.fromCharCode(65 + i);
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = teamNames[team] || `Team ${team}`;
    hostTeamSelect.appendChild(opt);
  }
}

teamCountSelect.addEventListener("change", () => {
  const count = parseInt(teamCountSelect.value, 10) || 2;
  buildTeamNameFields(count);
  buildHostTeamOptions(count, getTeamNamesFromInputs());
});

buildTeamNameFields(parseInt(teamCountSelect.value, 10) || 2);
buildHostTeamOptions(parseInt(teamCountSelect.value, 10) || 2, getTeamNamesFromInputs());

teamNameFields.addEventListener("input", () => {
  const count = parseInt(teamCountSelect.value, 10) || 2;
  const current = hostTeamSelect.value;
  buildHostTeamOptions(count, getTeamNamesFromInputs());
  if (current) hostTeamSelect.value = current;
});

function toggleAdvanced() {
  advancedSettings.classList.toggle("hidden", nsbRulesCheckbox.checked);
}

nsbRulesCheckbox.addEventListener("change", toggleAdvanced);
toggleAdvanced();

async function createRoom() {
  createError.textContent = "";
  const user = await ensureAnonAuth();
  const roomCode = generateRoomCode();
  const teamCount = parseInt(teamCountSelect.value, 10) || 2;
  const useNsb = nsbRulesCheckbox.checked;
  const tuTime = parseInt(tuTimeInput.value, 10) || 5;
  const bonusTime = parseInt(bonusTimeInput.value, 10) || 20;
  const roomName = roomNameInput.value.trim() || "Buzzer Room";
  const hostName = hostNameInput?.value.trim() || "Host";
  const hostTeam = hostTeamSelect?.value || "A";
  const teamNames = getTeamNamesFromInputs();

  const roomRef = doc(collection(db, "rooms"));
  const roomId = roomRef.id;

  const roomData = {
    roomCode,
    roomName,
    hostUid: user.uid,
    createdAt: serverTimestamp(),
    status: "lobby",
    currentIndex: 0,
    currentBuzz: null,
    scores: buildInitialScores(teamCount),
    timers: null,
    lockoutTeam: null,
    currentCategory: null,
    lastAction: null,
    bonusTeam: "A",
    settings: {
      teamCount,
      nsbRules: useNsb,
      tuTime,
      bonusTime,
      teamNames
    }
  };

  await setDoc(roomRef, roomData);
  await setDoc(doc(collection(roomRef, "players"), user.uid), {
    name: hostName,
    team: hostTeam,
    joinedAt: serverTimestamp(),
    isHost: true
  });

  localStorage.setItem("atom_buzzer_profile", JSON.stringify({
    name: hostName,
    team: hostTeam
  }));
  localStorage.setItem("atom_buzzer_role", "host");

  window.location.href = `buzzer_room.html?roomId=${roomId}`;
}

function buildInitialScores(teamCount) {
  const scores = {};
  for (let i = 0; i < teamCount; i += 1) {
    scores[String.fromCharCode(65 + i)] = 0;
  }
  return scores;
}

createRoomBtn.addEventListener("click", () => {
  createRoom().catch((err) => {
    console.error(err);
    createError.textContent = "Create failed. Try again.";
  });
});
