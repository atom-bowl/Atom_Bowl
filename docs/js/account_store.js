// @ts-nocheck
import { auth, db } from "./firebase.js";
// @ts-ignore
import { GoogleAuthProvider, OAuthProvider, EmailAuthProvider, signInWithPopup, linkWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, linkWithCredential, signOut as fbSignOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
// @ts-ignore
import { doc, getDoc, setDoc, serverTimestamp, increment, runTransaction } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
const SETTINGS_KEY = "atom_settings_v1";
const BUZZER_PROFILE_KEY = "atom_buzzer_profile";
const GUEST_TAG_KEY = "atom_guest_tag_v1";
let currentUser = auth.currentUser || null;
let currentProfile = null;
const listeners = new Set();
function notify(user) {
    listeners.forEach((cb) => {
        try {
            cb(user);
        }
        catch { }
    });
}
function getUser() {
    return currentUser;
}
function getProfile() {
    return currentProfile || null;
}
function onAuthChange(cb) {
    listeners.add(cb);
    cb(currentUser);
    return () => listeners.delete(cb);
}
function safeJsonParse(raw) {
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
}
function sanitizeUsername(username) {
    return normalizeUsername(username).replace(/[^a-z0-9]/g, "");
}
function usersRef(uid) {
    return doc(db, "users", uid);
}
function usernameRef(username) {
    return doc(db, "usernames", sanitizeUsername(username));
}
function settingsRef(uid) {
    return doc(db, "users", uid, "settings", "current");
}
function buzzerProfileRef(uid) {
    return doc(db, "users", uid, "buzzerProfile", "current");
}
function statsRef(uid) {
    return doc(db, "users", uid, "stats", "lifetime");
}
function randomAlphaNum(size) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < size; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}
function getGuestTag() {
    const existing = (localStorage.getItem(GUEST_TAG_KEY) || "").trim();
    if (existing && /^[A-Za-z0-9]{12}$/.test(existing))
        return existing;
    const tag = randomAlphaNum(12);
    try {
        localStorage.setItem(GUEST_TAG_KEY, tag);
    }
    catch { }
    return tag;
}
async function loadUserProfile(uid) {
    if (!uid)
        return null;
    const snap = await getDoc(usersRef(uid));
    if (!snap.exists())
        return null;
    const data = snap.data() || {};
    return data.profile || null;
}
async function ensureUserDoc(user) {
    if (!(user === null || user === void 0 ? void 0 : user.uid))
        return;
    const providerIds = Array.isArray(user.providerData)
        ? user.providerData.map((p) => p === null || p === void 0 ? void 0 : p.providerId).filter(Boolean)
        : [];
    const existingProfile = await loadUserProfile(user.uid);
    const mergedProfile = {
        username: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.username) || "",
        displayName: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.displayName) || user.displayName || "",
        playerName: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.playerName) || user.displayName || "",
        firstName: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.firstName) || "",
        lastName: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.lastName) || "",
        email: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.email) || user.email || "",
        phone: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.phone) || "",
        photoURL: (existingProfile === null || existingProfile === void 0 ? void 0 : existingProfile.photoURL) || user.photoURL || "",
        providerIds
    };
    await setDoc(usersRef(user.uid), {
        profile: mergedProfile,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
    }, { merge: true });
    currentProfile = mergedProfile;
}
async function reserveUsername(username, uid, email) {
    const clean = sanitizeUsername(username);
    if (!clean || clean.length < 3 || clean.length > 20) {
        throw new Error("Username must be 3-20 letters/numbers.");
    }
    await runTransaction(db, async (tx) => {
        var _a;
        const ref = usernameRef(clean);
        const snap = await tx.get(ref);
        if (snap.exists()) {
            const ownerUid = ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.uid) || "";
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
async function isUsernameAvailable(username) {
    var _a;
    const clean = sanitizeUsername(username);
    if (!clean || clean.length < 3 || clean.length > 20)
        return false;
    const snap = await getDoc(usernameRef(clean));
    if (!snap.exists())
        return true;
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        return false;
    return ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.uid) === currentUser.uid;
}
async function resolveEmailFromUsername(username) {
    var _a;
    const clean = sanitizeUsername(username);
    if (!clean)
        return "";
    const snap = await getDoc(usernameRef(clean));
    if (!snap.exists())
        return "";
    return String(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.email) || "").trim();
}
async function loadRemoteSettings() {
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        return null;
    const ref = settingsRef(currentUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists())
        return null;
    const data = snap.data();
    return (data === null || data === void 0 ? void 0 : data.value) || null;
}
async function syncSettings(user) {
    var _a;
    if (!(user === null || user === void 0 ? void 0 : user.uid))
        return;
    const ref = settingsRef(user.uid);
    const snap = await getDoc(ref);
    const local = safeJsonParse(localStorage.getItem(SETTINGS_KEY));
    if (snap.exists() && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.value)) {
        const value = snap.data().value;
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
        }
        catch { }
        window.atomSettings = value;
        document.dispatchEvent(new CustomEvent("atomSettingsSynced", { detail: value }));
        return;
    }
    if (local) {
        await setDoc(ref, { value: local, updatedAt: serverTimestamp() }, { merge: true });
    }
}
async function saveSettings(settings) {
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        return;
    const ref = settingsRef(currentUser.uid);
    await setDoc(ref, { value: settings, updatedAt: serverTimestamp() }, { merge: true });
}
async function loadBuzzerProfile() {
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        return null;
    const ref = buzzerProfileRef(currentUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists())
        return null;
    return snap.data() || null;
}
async function syncBuzzerProfile(user) {
    if (!(user === null || user === void 0 ? void 0 : user.uid))
        return;
    const ref = buzzerProfileRef(user.uid);
    const snap = await getDoc(ref);
    const local = safeJsonParse(localStorage.getItem(BUZZER_PROFILE_KEY));
    if (snap.exists()) {
        const value = snap.data() || {};
        try {
            localStorage.setItem(BUZZER_PROFILE_KEY, JSON.stringify({
                name: (value === null || value === void 0 ? void 0 : value.name) || "",
                team: (value === null || value === void 0 ? void 0 : value.team) || "A"
            }));
        }
        catch { }
        return;
    }
    if (local) {
        await setDoc(ref, {
            name: (local === null || local === void 0 ? void 0 : local.name) || "",
            team: (local === null || local === void 0 ? void 0 : local.team) || "A",
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
}
async function saveBuzzerProfile(profile) {
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        return;
    const ref = buzzerProfileRef(currentUser.uid);
    await setDoc(ref, {
        name: (profile === null || profile === void 0 ? void 0 : profile.name) || "",
        team: (profile === null || profile === void 0 ? void 0 : profile.team) || "A",
        updatedAt: serverTimestamp()
    }, { merge: true });
}
async function loadPracticeStats() {
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        return null;
    const snap = await getDoc(statsRef(currentUser.uid));
    if (!snap.exists())
        return null;
    return snap.data() || null;
}
async function updatePracticeStats(patch) {
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        return;
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
function buildProvider(providerId) {
    if (providerId === "google")
        return new GoogleAuthProvider();
    if (providerId === "microsoft")
        return new OAuthProvider("microsoft.com");
    return null;
}
async function signInWithProvider(providerId) {
    var _a;
    const provider = buildProvider(providerId);
    if (!provider)
        throw new Error("unknown-provider");
    if ((_a = auth.currentUser) === null || _a === void 0 ? void 0 : _a.isAnonymous) {
        try {
            const res = await linkWithPopup(auth.currentUser, provider);
            return res.user;
        }
        catch (err) {
            const code = (err === null || err === void 0 ? void 0 : err.code) || "";
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
async function signInWithEmail(email, password) {
    var _a;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail)
        throw new Error("Email is required.");
    if ((_a = auth.currentUser) === null || _a === void 0 ? void 0 : _a.isAnonymous) {
        const cred = EmailAuthProvider.credential(normalizedEmail, password);
        try {
            const res = await linkWithCredential(auth.currentUser, cred);
            return res.user;
        }
        catch (err) {
            const code = (err === null || err === void 0 ? void 0 : err.code) || "";
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
async function signInWithIdentifier(identifier, password) {
    const id = String(identifier || "").trim();
    if (!id || !password)
        throw new Error("Email/Username and password are required.");
    if (id.includes("@")) {
        return signInWithEmail(id, password);
    }
    const email = await resolveEmailFromUsername(id);
    if (!email)
        throw new Error("Username not found.");
    return signInWithEmail(email, password);
}
async function signUpWithEmail(email, password, displayName = "") {
    var _a;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if ((_a = auth.currentUser) === null || _a === void 0 ? void 0 : _a.isAnonymous) {
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
async function signUpWithDetails(details) {
    const firstName = String((details === null || details === void 0 ? void 0 : details.firstName) || "").trim();
    const lastName = String((details === null || details === void 0 ? void 0 : details.lastName) || "").trim();
    const email = String((details === null || details === void 0 ? void 0 : details.email) || "").trim().toLowerCase();
    const phone = String((details === null || details === void 0 ? void 0 : details.phone) || "").trim();
    const username = sanitizeUsername((details === null || details === void 0 ? void 0 : details.username) || "");
    const password = String((details === null || details === void 0 ? void 0 : details.password) || "");
    const playerName = String((details === null || details === void 0 ? void 0 : details.playerName) || `${firstName} ${lastName}` || "").trim();
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
        photoURL: (user === null || user === void 0 ? void 0 : user.photoURL) || ""
    };
    await setDoc(usersRef(user.uid), {
        profile,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
    }, { merge: true });
    currentProfile = profile;
    return user;
}
async function updateAccountProfile(patch) {
    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.uid))
        throw new Error("Not signed in.");
    const prev = currentProfile || (await loadUserProfile(currentUser.uid)) || {};
    const next = {
        ...prev,
        playerName: (patch === null || patch === void 0 ? void 0 : patch.playerName) != null ? String(patch.playerName).trim() : (prev.playerName || ""),
        displayName: (patch === null || patch === void 0 ? void 0 : patch.playerName) != null ? String(patch.playerName).trim() : (prev.displayName || ""),
        firstName: (patch === null || patch === void 0 ? void 0 : patch.firstName) != null ? String(patch.firstName).trim() : (prev.firstName || ""),
        lastName: (patch === null || patch === void 0 ? void 0 : patch.lastName) != null ? String(patch.lastName).trim() : (prev.lastName || ""),
        phone: (patch === null || patch === void 0 ? void 0 : patch.phone) != null ? String(patch.phone).trim() : (prev.phone || ""),
        photoURL: (patch === null || patch === void 0 ? void 0 : patch.photoURL) != null ? String(patch.photoURL).trim() : (prev.photoURL || "")
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
    }
    catch { }
    return next;
}
async function signOut() {
    await fbSignOut(auth);
}
onAuthStateChanged(auth, async (user) => {
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
    }
    catch (err) {
        console.warn("Account sync failed", err);
    }
    finally {
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
//# sourceMappingURL=account_store.js.map