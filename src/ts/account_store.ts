// @ts-nocheck
import { auth, db } from "./firebase.js";
// @ts-ignore
import {
  GoogleAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  linkWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
// @ts-ignore
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  increment,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const SETTINGS_KEY = "atom_settings_v1";
const BUZZER_PROFILE_KEY = "atom_buzzer_profile";
const GUEST_TAG_KEY = "atom_guest_tag_v1";

let currentUser: any = auth.currentUser || null;
let currentProfile: any = null;
const listeners = new Set<(user: unknown | null) => void>();

function notify(user: unknown | null) {
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch {}
  });
}

function getUser() {
  return currentUser;
}

function getProfile() {
  return currentProfile || null;
}

function onAuthChange(cb: (user: unknown | null) => void) {
  listeners.add(cb);
  cb(currentUser);
  return () => listeners.delete(cb);
}

function safeJsonParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeUsername(username: string) {
  return String(username || "").trim().toLowerCase();
}

function sanitizeUsername(username: string) {
  return normalizeUsername(username).replace(/[^a-z0-9]/g, "");
}

function usersRef(uid: string) {
  return doc(db, "users", uid);
}

function usernameRef(username: string) {
  return doc(db, "usernames", sanitizeUsername(username));
}

function settingsRef(uid: string) {
  return doc(db, "users", uid, "settings", "current");
}

function buzzerProfileRef(uid: string) {
  return doc(db, "users", uid, "buzzerProfile", "current");
}

function statsRef(uid: string) {
  return doc(db, "users", uid, "stats", "lifetime");
}

function randomAlphaNum(size: number) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function getGuestTag() {
  const existing = (localStorage.getItem(GUEST_TAG_KEY) || "").trim();
  if (existing && /^[A-Za-z0-9]{12}$/.test(existing)) return existing;
  const tag = randomAlphaNum(12);
  try {
    localStorage.setItem(GUEST_TAG_KEY, tag);
  } catch {}
  return tag;
}

async function loadUserProfile(uid: string) {
  if (!uid) return null;
  const snap = await getDoc(usersRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return data.profile || null;
}

async function ensureUserDoc(user: any) {
  if (!user?.uid) return;
  const providerIds = Array.isArray(user.providerData)
    ? user.providerData.map((p: any) => p?.providerId).filter(Boolean)
    : [];
  const existingProfile = await loadUserProfile(user.uid);
  const mergedProfile = {
    username: existingProfile?.username || "",
    displayName: existingProfile?.displayName || user.displayName || "",
    playerName: existingProfile?.playerName || user.displayName || "",
    firstName: existingProfile?.firstName || "",
    lastName: existingProfile?.lastName || "",
    email: existingProfile?.email || user.email || "",
    phone: existingProfile?.phone || "",
    photoURL: existingProfile?.photoURL || user.photoURL || "",
    providerIds
  };
  await setDoc(usersRef(user.uid), {
    profile: mergedProfile,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  }, { merge: true });
  currentProfile = mergedProfile;
}

async function reserveUsername(username: string, uid: string, email: string) {
  const clean = sanitizeUsername(username);
  if (!clean || clean.length < 3 || clean.length > 20) {
    throw new Error("Username must be 3-20 letters/numbers.");
  }
  await runTransaction(db, async (tx: any) => {
    const ref = usernameRef(clean);
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const ownerUid = snap.data()?.uid || "";
      if (ownerUid && ownerUid !== uid) {
        throw new Error("That username is already taken.");
      }
    }
    tx.set(ref, {
      uid,
      email: String(email || "").trim().toLowerCase(),
      username: clean,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
}

async function isUsernameAvailable(username: string) {
  const clean = sanitizeUsername(username);
  if (!clean || clean.length < 3 || clean.length > 20) return false;
  const snap = await getDoc(usernameRef(clean));
  if (!snap.exists()) return true;
  if (!currentUser?.uid) return false;
  return snap.data()?.uid === currentUser.uid;
}

async function resolveEmailFromUsername(username: string) {
  const clean = sanitizeUsername(username);
  if (!clean) return "";
  const snap = await getDoc(usernameRef(clean));
  if (!snap.exists()) return "";
  return String(snap.data()?.email || "").trim();
}

async function loadRemoteSettings() {
  if (!currentUser?.uid) return null;
  const ref = settingsRef(currentUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return data?.value || null;
}

async function syncSettings(user: any) {
  if (!user?.uid) return;
  const ref = settingsRef(user.uid);
  const snap = await getDoc(ref);
  const local = safeJsonParse(localStorage.getItem(SETTINGS_KEY));

  if (snap.exists() && snap.data()?.value) {
    const value = snap.data().value;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
    } catch {}
    (window as any).atomSettings = value;
    document.dispatchEvent(new CustomEvent("atomSettingsSynced", { detail: value }));
    return;
  }

  if (local) {
    await setDoc(ref, { value: local, updatedAt: serverTimestamp() }, { merge: true });
  }
}

async function saveSettings(settings: any) {
  if (!currentUser?.uid) return;
  const ref = settingsRef(currentUser.uid);
  await setDoc(ref, { value: settings, updatedAt: serverTimestamp() }, { merge: true });
}

async function loadBuzzerProfile() {
  if (!currentUser?.uid) return null;
  const ref = buzzerProfileRef(currentUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() || null;
}

async function syncBuzzerProfile(user: any) {
  if (!user?.uid) return;
  const ref = buzzerProfileRef(user.uid);
  const snap = await getDoc(ref);
  const local = safeJsonParse(localStorage.getItem(BUZZER_PROFILE_KEY));

  if (snap.exists()) {
    const value = snap.data() || {};
    try {
      localStorage.setItem(BUZZER_PROFILE_KEY, JSON.stringify({
        name: value?.name || "",
        team: value?.team || "A"
      }));
    } catch {}
    return;
  }

  if (local) {
    await setDoc(ref, {
      name: local?.name || "",
      team: local?.team || "A",
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function saveBuzzerProfile(profile: { name?: string; team?: string }) {
  if (!currentUser?.uid) return;
  const ref = buzzerProfileRef(currentUser.uid);
  await setDoc(ref, {
    name: profile?.name || "",
    team: profile?.team || "A",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function loadPracticeStats() {
  if (!currentUser?.uid) return null;
  const snap = await getDoc(statsRef(currentUser.uid));
  if (!snap.exists()) return null;
  return snap.data() || null;
}

async function updatePracticeStats(patch: {
  totalRuns?: number;
  totalAnswered?: number;
  totalCorrect?: number;
  totalTime?: number;
  totalSlowCorrect?: number;
}) {
  if (!currentUser?.uid) return;
  const ref = statsRef(currentUser.uid);
  const next = {
    totalRuns: increment(Number(patch.totalRuns || 0)),
    totalAnswered: increment(Number(patch.totalAnswered || 0)),
    totalCorrect: increment(Number(patch.totalCorrect || 0)),
    totalTime: increment(Number(patch.totalTime || 0)),
    totalSlowCorrect: increment(Number(patch.totalSlowCorrect || 0)),
    lastRunAt: serverTimestamp()
  };
  await setDoc(ref, next, { merge: true });
}

function buildProvider(providerId: string) {
  if (providerId === "google") return new GoogleAuthProvider();
  if (providerId === "microsoft") return new OAuthProvider("microsoft.com");
  return null;
}

async function signInWithProvider(providerId: string) {
  const provider = buildProvider(providerId);
  if (!provider) throw new Error("unknown-provider");

  if (auth.currentUser?.isAnonymous) {
    try {
      const res = await linkWithPopup(auth.currentUser, provider);
      return res.user;
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/credential-already-in-use") {
        const res = await signInWithPopup(auth, provider);
        return res.user;
      }
      throw err;
    }
  }

  const res = await signInWithPopup(auth, provider);
  return res.user;
}

async function signInWithEmail(email: string, password: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required.");
  if (auth.currentUser?.isAnonymous) {
    const cred = EmailAuthProvider.credential(normalizedEmail, password);
    try {
      const res = await linkWithCredential(auth.currentUser, cred);
      return res.user;
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        const res = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        return res.user;
      }
      throw err;
    }
  }

  const res = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  return res.user;
}

async function signInWithIdentifier(identifier: string, password: string) {
  const id = String(identifier || "").trim();
  if (!id || !password) throw new Error("Email/Username and password are required.");
  if (id.includes("@")) {
    return signInWithEmail(id, password);
  }
  const email = await resolveEmailFromUsername(id);
  if (!email) throw new Error("Username not found.");
  return signInWithEmail(email, password);
}

async function signUpWithEmail(email: string, password: string, displayName = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (auth.currentUser?.isAnonymous) {
    const cred = EmailAuthProvider.credential(normalizedEmail, password);
    const res = await linkWithCredential(auth.currentUser, cred);
    if (displayName) {
      await updateProfile(res.user, { displayName });
    }
    return res.user;
  }

  const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  if (displayName) {
    await updateProfile(res.user, { displayName });
  }
  return res.user;
}

async function signUpWithDetails(details: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  username: string;
  password: string;
  playerName?: string;
}) {
  const firstName = String(details?.firstName || "").trim();
  const lastName = String(details?.lastName || "").trim();
  const email = String(details?.email || "").trim().toLowerCase();
  const phone = String(details?.phone || "").trim();
  const username = sanitizeUsername(details?.username || "");
  const password = String(details?.password || "");
  const playerName = String(details?.playerName || `${firstName} ${lastName}` || "").trim();

  if (!firstName || !lastName || !email || !username || !password) {
    throw new Error("Please complete all required fields.");
  }

  const user = await signUpWithEmail(email, password, playerName || username);
  await reserveUsername(username, user.uid, email);

  const profile = {
    username,
    displayName: playerName || username,
    playerName: playerName || username,
    firstName,
    lastName,
    email,
    phone,
    photoURL: user?.photoURL || ""
  };
  await setDoc(usersRef(user.uid), {
    profile,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  }, { merge: true });
  currentProfile = profile;
  return user;
}

async function updateAccountProfile(patch: {
  playerName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  photoURL?: string;
}) {
  if (!currentUser?.uid) throw new Error("Not signed in.");
  const prev = currentProfile || (await loadUserProfile(currentUser.uid)) || {};
  const next = {
    ...prev,
    playerName: patch?.playerName != null ? String(patch.playerName).trim() : (prev.playerName || ""),
    displayName: patch?.playerName != null ? String(patch.playerName).trim() : (prev.displayName || ""),
    firstName: patch?.firstName != null ? String(patch.firstName).trim() : (prev.firstName || ""),
    lastName: patch?.lastName != null ? String(patch.lastName).trim() : (prev.lastName || ""),
    phone: patch?.phone != null ? String(patch.phone).trim() : (prev.phone || ""),
    photoURL: patch?.photoURL != null ? String(patch.photoURL).trim() : (prev.photoURL || "")
  };
  await setDoc(usersRef(currentUser.uid), {
    profile: next,
    updatedAt: serverTimestamp()
  }, { merge: true });
  currentProfile = next;
  try {
    await updateProfile(currentUser, {
      displayName: next.playerName || next.displayName || "",
      photoURL: next.photoURL || ""
    });
  } catch {}
  return next;
}

async function signOut() {
  await fbSignOut(auth);
}

onAuthStateChanged(auth, async (user: any) => {
  currentUser = user || null;
  if (!user) {
    currentProfile = null;
    notify(currentUser);
    return;
  }
  try {
    await ensureUserDoc(user);
    await syncSettings(user);
    await syncBuzzerProfile(user);
    currentProfile = await loadUserProfile(user.uid);
  } catch (err) {
    console.warn("Account sync failed", err);
  } finally {
    notify(currentUser);
  }
});

window.atomAccount = {
  getUser,
  getProfile,
  getGuestTag,
  onAuthChange,
  signInWithProvider,
  signInWithEmail,
  signInWithIdentifier,
  signUpWithEmail,
  signUpWithDetails,
  signOut,
  loadRemoteSettings,
  saveSettings,
  updatePracticeStats,
  loadPracticeStats,
  isUsernameAvailable,
  resolveEmailFromUsername,
  updateAccountProfile,
  loadBuzzerProfile,
  saveBuzzerProfile
};
