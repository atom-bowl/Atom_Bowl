import { db, ensureAnonAuth } from "./firebase.js";
import {
  doc,
  collection,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const joinCodeInput = document.getElementById("joinCode");
const displayNameInput = document.getElementById("displayName");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const joinError = document.getElementById("joinError");
const teamSelect = document.getElementById("teamSelect");
const goCreateBtn = document.getElementById("goCreateBtn");

const state = { team: "A" };

teamSelect.addEventListener("change", () => {
  state.team = teamSelect.value;
});

joinCodeInput.addEventListener("input", () => {
  joinCodeInput.value = joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  const q = query(collection(db, "rooms"), where("roomCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) {
    joinError.textContent = "Room not found.";
    return;
  }
  const roomDoc = snap.docs[0];
  await setDoc(doc(collection(roomDoc.ref, "players"), user.uid), {
    name,
    team: state.team,
    joinedAt: serverTimestamp(),
    isHost: false
  });
  localStorage.setItem("atom_buzzer_profile", JSON.stringify({
    name,
    team: state.team
  }));
  window.location.href = `buzzer_room.html?roomId=${roomDoc.id}`;
}

joinRoomBtn.addEventListener("click", () => {
  joinRoom().catch((err) => {
    console.error(err);
    joinError.textContent = "Join failed. Try again.";
  });
});
