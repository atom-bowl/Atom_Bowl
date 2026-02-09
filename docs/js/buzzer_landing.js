import { db, ensureAnonAuth } from "./firebase.js";
import "./account_store.js";
import {
  doc,
  collection,
  setDoc,
  serverTimestamp,
  getDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const joinCodeInput = document.getElementById("joinCode");
const displayNameInput = document.getElementById("displayName");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const joinError = document.getElementById("joinError");
const teamSelect = document.getElementById("teamSelect");
const teamHint = document.getElementById("teamHint");
const goCreateBtn = document.getElementById("goCreateBtn");

const state = { team: "A", roomId: null };
const BUZZER_PROFILE_KEY = "atom_buzzer_profile";
let preferredTeam = null;

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setTeamOptions(teamCount, teamNames) {
  teamSelect.innerHTML = "";
  const count = Math.max(2, Math.min(4, teamCount || 2));
  for (let i = 0; i < count; i += 1) {
    const team = String.fromCharCode(65 + i);
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = teamNames?.[team] || `Team ${team}`;
    teamSelect.appendChild(opt);
  }
  if (preferredTeam && [...teamSelect.options].some((opt) => opt.value === preferredTeam)) {
    teamSelect.value = preferredTeam;
  }
  state.team = teamSelect.value;
}

setTeamOptions(2);

teamSelect.addEventListener("change", () => {
  state.team = teamSelect.value;
});

const localProfile = safeParse(localStorage.getItem(BUZZER_PROFILE_KEY)) || {};
if (displayNameInput && localProfile?.name) displayNameInput.value = localProfile.name;
if (localProfile?.team) {
  preferredTeam = localProfile.team;
  setTeamOptions(2);
}

if (window.atomAccount?.onAuthChange) {
  window.atomAccount.onAuthChange(async (user) => {
    if (!user) return;
    try {
      const remote = await window.atomAccount.loadBuzzerProfile();
      if (remote?.name && displayNameInput) displayNameInput.value = remote.name;
      if (remote?.team) {
        preferredTeam = remote.team;
        if (teamSelect?.options?.length) {
          const match = [...teamSelect.options].some((opt) => opt.value === preferredTeam);
          if (match) {
            teamSelect.value = preferredTeam;
            state.team = teamSelect.value;
          }
        }
      }
    } catch {}
  });
}

let lookupTimer = null;

joinCodeInput.addEventListener("input", () => {
  joinCodeInput.value = joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = joinCodeInput.value.trim();
  if (lookupTimer) clearTimeout(lookupTimer);
  if (code.length < 5) {
    teamHint.textContent = "Teams will load when a valid code is entered.";
    setTeamOptions(2);
    state.roomId = null;
    return;
  }
  lookupTimer = setTimeout(() => {
    lookupRoomTeams(code).catch(() => {
      teamHint.textContent = "Room not found yet.";
      setTeamOptions(2);
      state.roomId = null;
    });
  }, 250);
});

goCreateBtn.addEventListener("click", () => {
  window.location.href = "buzzer_create.html";
});

async function joinRoom() {
  joinError.textContent = "";
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) {
    joinError.textContent = "Enter a room code.";
    return;
  }
  const user = await ensureAnonAuth();
  const name = displayNameInput.value.trim() || "Player";
  const roomDoc = state.roomId
    ? await getDoc(doc(db, "rooms", state.roomId))
    : null;
  let room = roomDoc?.exists() ? roomDoc : null;
  if (!room) {
    const q = query(collection(db, "rooms"), where("roomCode", "==", code));
    const snap = await getDocs(q);
    if (!snap.empty) room = snap.docs[0];
  }
  if (!room) {
    joinError.textContent = "Room not found.";
    return;
  }
  await setDoc(doc(collection(room.ref, "players"), user.uid), {
    name,
    team: state.team,
    joinedAt: serverTimestamp(),
    isHost: false
  });
  localStorage.setItem("atom_buzzer_profile", JSON.stringify({
    name,
    team: state.team
  }));
  localStorage.setItem("atom_buzzer_role", "player");
  if (window.atomAccount?.getUser?.()) {
    window.atomAccount.saveBuzzerProfile({
      name,
      team: state.team
    }).catch(() => {});
  }
  window.location.href = `buzzer_room_player.html?roomId=${room.id}`;
}

async function lookupRoomTeams(code) {
  await ensureAnonAuth();
  const q = query(collection(db, "rooms"), where("roomCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("not found");
  const roomDoc = snap.docs[0];
  const data = roomDoc.data();
  const teamCount = data?.settings?.teamCount || 2;
  const teamNames = data?.settings?.teamNames || {};
  setTeamOptions(teamCount, teamNames);
  state.roomId = roomDoc.id;
  teamHint.textContent = `Room found: ${teamCount} teams.`;
}

joinRoomBtn.addEventListener("click", () => {
  joinRoom().catch((err) => {
    console.error(err);
    joinError.textContent = "Join failed. Try again.";
  });
});
