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
  if (!errorEl) return;
  errorEl.textContent = msg || "";
}

function setBusy(isBusy) {
  [googleBtn, microsoftBtn, emailSignInBtn, emailSignUpBtn, signOutBtn].forEach((btn) => {
    if (!btn) return;
    (btn as HTMLButtonElement).disabled = isBusy;
  });
}

function renderSignedOut() {
  if (statusText) statusText.textContent = "Signed out";
  if (statusSub) statusSub.textContent = "Sign in to sync settings and stats.";
  if (profileName) profileName.textContent = "Guest";
  if (profileEmail) profileEmail.textContent = "No account connected";
  if (profilePhoto) (profilePhoto as HTMLImageElement).src = "favicon.png";
  if (signOutBtn) signOutBtn.classList.add("hidden");
}

function renderSignedIn(user: any) {
  const displayName = user?.displayName || "Player";
  const email = user?.email || "Linked account";
  const photo = user?.photoURL || "favicon.png";
  if (statusText) statusText.textContent = "Signed in";
  if (statusSub) statusSub.textContent = "Your settings and stats are synced.";
  if (profileName) profileName.textContent = displayName;
  if (profileEmail) profileEmail.textContent = email;
  if (profilePhoto) (profilePhoto as HTMLImageElement).src = photo;
  if (signOutBtn) signOutBtn.classList.remove("hidden");
}

function handleAuthChange(user: any) {
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

if (window.atomAccount?.onAuthChange) {
  window.atomAccount.onAuthChange(handleAuthChange);
} else {
  renderSignedOut();
}

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    setError("");
    const account = requireAccount();
    if (!account) return;
    setBusy(true);
    try {
      await account.signInWithProvider("google");
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
    } finally {
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
    setError("");
    const account = requireAccount();
    if (!account) return;
    const email = (emailInput as HTMLInputElement)?.value?.trim();
    const password = (passwordInput as HTMLInputElement)?.value || "";
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      await account.signInWithEmail(email, password);
    } catch (err: any) {
      setError(err?.message || "Email sign-in failed.");
    } finally {
      setBusy(false);
    }
  });
}

if (emailSignUpBtn) {
  emailSignUpBtn.addEventListener("click", async () => {
    setError("");
    const account = requireAccount();
    if (!account) return;
    const email = (emailInput as HTMLInputElement)?.value?.trim();
    const password = (passwordInput as HTMLInputElement)?.value || "";
    const displayName = (displayNameInput as HTMLInputElement)?.value?.trim() || "";
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      await account.signUpWithEmail(email, password, displayName);
    } catch (err: any) {
      setError(err?.message || "Account creation failed.");
    } finally {
      setBusy(false);
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    setError("");
    const account = requireAccount();
    if (!account) return;
    setBusy(true);
    try {
      await account.signOut();
    } catch (err: any) {
      setError(err?.message || "Sign out failed.");
    } finally {
      setBusy(false);
    }
  });
}
