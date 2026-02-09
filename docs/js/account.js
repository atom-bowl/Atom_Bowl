var _a;
import "./account_store.js";
const statusText = document.getElementById("statusText");
const statusSub = document.getElementById("statusSub");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profilePhoto = document.getElementById("profilePhoto");
const signOutBtn = document.getElementById("signOutBtn");
const googleBtn = document.getElementById("googleBtn");
const microsoftBtn = document.getElementById("microsoftBtn");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const displayNameInput = document.getElementById("displayNameInput");
const emailSignInBtn = document.getElementById("emailSignInBtn");
const emailSignUpBtn = document.getElementById("emailSignUpBtn");
const errorEl = document.getElementById("authError");
function setError(msg) {
    if (!errorEl)
        return;
    errorEl.textContent = msg || "";
}
function setBusy(isBusy) {
    [googleBtn, microsoftBtn, emailSignInBtn, emailSignUpBtn, signOutBtn].forEach((btn) => {
        if (!btn)
            return;
        btn.disabled = isBusy;
    });
}
function renderSignedOut() {
    if (statusText)
        statusText.textContent = "Signed out";
    if (statusSub)
        statusSub.textContent = "Sign in to sync settings and stats.";
    if (profileName)
        profileName.textContent = "Guest";
    if (profileEmail)
        profileEmail.textContent = "No account connected";
    if (profilePhoto)
        profilePhoto.src = "favicon.png";
    if (signOutBtn)
        signOutBtn.classList.add("hidden");
}
function renderSignedIn(user) {
    const displayName = (user === null || user === void 0 ? void 0 : user.displayName) || "Player";
    const email = (user === null || user === void 0 ? void 0 : user.email) || "Linked account";
    const photo = (user === null || user === void 0 ? void 0 : user.photoURL) || "favicon.png";
    if (statusText)
        statusText.textContent = "Signed in";
    if (statusSub)
        statusSub.textContent = "Your settings and stats are synced.";
    if (profileName)
        profileName.textContent = displayName;
    if (profileEmail)
        profileEmail.textContent = email;
    if (profilePhoto)
        profilePhoto.src = photo;
    if (signOutBtn)
        signOutBtn.classList.remove("hidden");
}
function handleAuthChange(user) {
    if (!user) {
        renderSignedOut();
        return;
    }
    renderSignedIn(user);
}
function requireAccount() {
    const account = window.atomAccount;
    if (!account) {
        setError("Account module failed to load.");
        return null;
    }
    return account;
}
if ((_a = window.atomAccount) === null || _a === void 0 ? void 0 : _a.onAuthChange) {
    window.atomAccount.onAuthChange(handleAuthChange);
}
else {
    renderSignedOut();
}
if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        setError("");
        const account = requireAccount();
        if (!account)
            return;
        setBusy(true);
        try {
            await account.signInWithProvider("google");
        }
        catch (err) {
            setError((err === null || err === void 0 ? void 0 : err.message) || "Google sign-in failed.");
        }
        finally {
            setBusy(false);
        }
    });
}
if (microsoftBtn) {
    microsoftBtn.addEventListener("click", async () => {
        window.location.href = "microsoft_auth.html";
    });
}
if (emailSignInBtn) {
    emailSignInBtn.addEventListener("click", async () => {
        var _a;
        setError("");
        const account = requireAccount();
        if (!account)
            return;
        const email = (_a = emailInput === null || emailInput === void 0 ? void 0 : emailInput.value) === null || _a === void 0 ? void 0 : _a.trim();
        const password = (passwordInput === null || passwordInput === void 0 ? void 0 : passwordInput.value) || "";
        if (!email || !password) {
            setError("Email and password are required.");
            return;
        }
        setBusy(true);
        try {
            await account.signInWithEmail(email, password);
        }
        catch (err) {
            setError((err === null || err === void 0 ? void 0 : err.message) || "Email sign-in failed.");
        }
        finally {
            setBusy(false);
        }
    });
}
if (emailSignUpBtn) {
    emailSignUpBtn.addEventListener("click", async () => {
        var _a, _b;
        setError("");
        const account = requireAccount();
        if (!account)
            return;
        const email = (_a = emailInput === null || emailInput === void 0 ? void 0 : emailInput.value) === null || _a === void 0 ? void 0 : _a.trim();
        const password = (passwordInput === null || passwordInput === void 0 ? void 0 : passwordInput.value) || "";
        const displayName = ((_b = displayNameInput === null || displayNameInput === void 0 ? void 0 : displayNameInput.value) === null || _b === void 0 ? void 0 : _b.trim()) || "";
        if (!email || !password) {
            setError("Email and password are required.");
            return;
        }
        setBusy(true);
        try {
            await account.signUpWithEmail(email, password, displayName);
        }
        catch (err) {
            setError((err === null || err === void 0 ? void 0 : err.message) || "Account creation failed.");
        }
        finally {
            setBusy(false);
        }
    });
}
if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
        setError("");
        const account = requireAccount();
        if (!account)
            return;
        setBusy(true);
        try {
            await account.signOut();
        }
        catch (err) {
            setError((err === null || err === void 0 ? void 0 : err.message) || "Sign out failed.");
        }
        finally {
            setBusy(false);
        }
    });
}
//# sourceMappingURL=account.js.map