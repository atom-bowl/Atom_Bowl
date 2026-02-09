// @ts-nocheck
import { auth, db } from "./firebase.js";
// @ts-ignore
import { GoogleAuthProvider, OAuthProvider, EmailAuthProvider, signInWithPopup, linkWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, linkWithCredential, signOut as fbSignOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
// @ts-ignore
import { doc, getDoc, setDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
const SETTINGS_KEY = "atom_settings_v1";
const BUZZER_PROFILE_KEY = "atom_buzzer_profile";
let currentUser = auth.currentUser || null;
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
async function ensureUserDoc(user) {
    if (!(user === null || user === void 0 ? void 0 : user.uid))
        return;
    const ref = doc(db, "users", user.uid);
    const providerIds = Array.isArray(user.providerData)
        ? user.providerData.map((p) => p === null || p === void 0 ? void 0 : p.providerId).filter(Boolean)
        : [];
    await setDoc(ref, {
        profile: {
            displayName: user.displayName || "",
            email: user.email || "",
            photoURL: user.photoURL || "",
            providerIds
        },
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
    }, { merge: true });
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
    if ((_a = auth.currentUser) === null || _a === void 0 ? void 0 : _a.isAnonymous) {
        const cred = EmailAuthProvider.credential(email, password);
        try {
            const res = await linkWithCredential(auth.currentUser, cred);
            return res.user;
        }
        catch (err) {
            const code = (err === null || err === void 0 ? void 0 : err.code) || "";
            if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
                const res = await signInWithEmailAndPassword(auth, email, password);
                return res.user;
            }
            throw err;
        }
    }
    const res = await signInWithEmailAndPassword(auth, email, password);
    return res.user;
}
async function signUpWithEmail(email, password, displayName = "") {
    var _a;
    if ((_a = auth.currentUser) === null || _a === void 0 ? void 0 : _a.isAnonymous) {
        const cred = EmailAuthProvider.credential(email, password);
        const res = await linkWithCredential(auth.currentUser, cred);
        if (displayName) {
            await updateProfile(res.user, { displayName });
        }
        return res.user;
    }
    const res = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
        await updateProfile(res.user, { displayName });
    }
    return res.user;
}
async function signOut() {
    await fbSignOut(auth);
}
onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    notify(currentUser);
    if (!user)
        return;
    try {
        await ensureUserDoc(user);
        await syncSettings(user);
        await syncBuzzerProfile(user);
    }
    catch (err) {
        console.warn("Account sync failed", err);
    }
});
window.atomAccount = {
    getUser,
    onAuthChange,
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    loadRemoteSettings,
    saveSettings,
    updatePracticeStats,
    loadBuzzerProfile,
    saveBuzzerProfile
};
//# sourceMappingURL=account_store.js.map
