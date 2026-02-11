import "./account_store.js";
const PROGRESS_KEY = "atom_learn_progress_v1";
const MANIFEST_URL = "data/lessons/index.json";
let manifest = null;
let activeSubject = "";
let completedLessons = new Set();
const subjectCache = new Map();
// DOM refs
const browserView = document.getElementById("browserView");
const readerView = document.getElementById("readerView");
const subjectTabs = document.getElementById("subjectTabs");
const lessonGrid = document.getElementById("lessonGrid");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const readerTitle = document.getElementById("readerTitle");
const lessonContent = document.getElementById("lessonContent");
const backBtn = document.getElementById("backBtn");
const completeBtn = document.getElementById("completeBtn");
const completeStatus = document.getElementById("completeStatus");
let currentLessonId = "";
// ---- Utility ----
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
// ---- Progress ----
function loadLocalProgress() {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function saveLocalProgress() {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completedLessons]));
    }
    catch { }
}
async function syncProgress() {
    var _a, _b, _c;
    const account = window.atomAccount;
    if (!account)
        return;
    const user = (_a = account.getUser) === null || _a === void 0 ? void 0 : _a.call(account);
    if (!user)
        return;
    try {
        const remote = await ((_b = account.loadLearnProgress) === null || _b === void 0 ? void 0 : _b.call(account));
        if (Array.isArray(remote)) {
            remote.forEach((id) => completedLessons.add(id));
        }
        saveLocalProgress();
        await ((_c = account.saveLearnProgress) === null || _c === void 0 ? void 0 : _c.call(account, [...completedLessons]));
    }
    catch { }
}
function getTotalLessons() {
    if (!manifest)
        return 0;
    return manifest.subjects.reduce((sum, s) => sum + s.lessons.length, 0);
}
function updateProgressUI() {
    const total = getTotalLessons();
    const done = completedLessons.size;
    progressText.textContent = `${done} / ${total} lessons completed`;
    const pct = total > 0 ? (done / total) * 100 : 0;
    progressFill.style.width = `${pct}%`;
}
// ---- Copy prevention ----
function setupCopyProtection() {
    const contentEl = lessonContent;
    if (!contentEl)
        return;
    document.addEventListener("copy", (e) => {
        if (!readerView.classList.contains("hidden"))
            e.preventDefault();
    });
    document.addEventListener("cut", (e) => {
        if (!readerView.classList.contains("hidden"))
            e.preventDefault();
    });
    document.addEventListener("contextmenu", (e) => {
        if (!readerView.classList.contains("hidden"))
            e.preventDefault();
    });
    document.addEventListener("selectstart", (e) => {
        if (!readerView.classList.contains("hidden"))
            e.preventDefault();
    });
    document.addEventListener("keydown", (e) => {
        if (readerView.classList.contains("hidden"))
            return;
        if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "a" || e.key === "C" || e.key === "A")) {
            e.preventDefault();
        }
    });
}
// ---- Data loading ----
async function loadManifest() {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok)
        throw new Error("Failed to load lesson manifest");
    return res.json();
}
async function loadSubjectData(file) {
    if (subjectCache.has(file))
        return subjectCache.get(file);
    const res = await fetch(`data/lessons/${file}`);
    if (!res.ok)
        throw new Error(`Failed to load ${file}`);
    const data = await res.json();
    subjectCache.set(file, data);
    return data;
}
// ---- Rendering ----
function renderTabs() {
    if (!manifest)
        return;
    let html = `<button class="subject-tab${activeSubject === "" ? " active" : ""}" data-subject="">All</button>`;
    for (const s of manifest.subjects) {
        const isActive = activeSubject === s.id;
        html += `<button class="subject-tab${isActive ? " active" : ""}" data-subject="${escapeHtml(s.id)}">${escapeHtml(s.icon)} ${escapeHtml(s.label)}</button>`;
    }
    subjectTabs.innerHTML = html;
}
function renderGrid() {
    if (!manifest)
        return;
    const subjects = activeSubject
        ? manifest.subjects.filter((s) => s.id === activeSubject)
        : manifest.subjects;
    let html = "";
    for (const s of subjects) {
        for (const l of s.lessons) {
            const done = completedLessons.has(l.id);
            html += `
        <div class="lesson-card${done ? " completed" : ""}" data-lesson="${escapeHtml(l.id)}" data-subject="${escapeHtml(s.id)}">
          <div class="lesson-card-title">${escapeHtml(s.icon)} ${escapeHtml(l.title)}</div>
          <div class="lesson-card-desc">${escapeHtml(l.description)}</div>
          <div class="lesson-card-footer">
            ${done ? `<span class="lesson-badge">Completed</span>` : `<span></span>`}
            <button class="btn read-btn" data-lesson="${escapeHtml(l.id)}" data-file="${escapeHtml(s.file)}" type="button">Read</button>
          </div>
        </div>`;
        }
    }
    if (!html) {
        html = `<div class="empty-state">No lessons found.</div>`;
    }
    lessonGrid.innerHTML = html;
}
function highlightKeyTerms(body, keyTerms) {
    if (!keyTerms.length)
        return escapeHtml(body);
    const escaped = escapeHtml(body);
    const sorted = [...keyTerms].sort((a, b) => b.length - a.length);
    let result = escaped;
    for (const term of sorted) {
        const escapedTerm = escapeHtml(term);
        const regex = new RegExp(`(?<![\\w-])${escapedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "gi");
        result = result.replace(regex, `<mark class="key-term">$&</mark>`);
    }
    return result;
}
function renderLesson(lesson) {
    let html = "";
    for (const section of lesson.sections) {
        html += `
      <div class="lesson-section">
        <h3>${escapeHtml(section.heading)}</h3>
        <div class="lesson-section-body">${highlightKeyTerms(section.body, section.keyTerms)}</div>
        ${section.keyTerms.length ? `
          <div class="key-terms-section">
            <div class="key-terms-label">Key Terms</div>
            <div class="key-terms-list">
              ${section.keyTerms.map((t) => `<span class="key-term-pill">${escapeHtml(t)}</span>`).join("")}
            </div>
          </div>` : ""}
      </div>`;
    }
    lessonContent.innerHTML = html;
}
// ---- View switching ----
function showBrowser() {
    browserView.classList.remove("hidden");
    readerView.classList.add("hidden");
    currentLessonId = "";
    renderGrid();
    updateProgressUI();
}
async function showReader(lessonId, file) {
    const subjectData = await loadSubjectData(file);
    const lesson = subjectData.lessons.find((l) => l.id === lessonId);
    if (!lesson)
        return;
    currentLessonId = lessonId;
    readerTitle.textContent = lesson.title;
    renderLesson(lesson);
    updateCompleteUI();
    browserView.classList.add("hidden");
    readerView.classList.remove("hidden");
    window.scrollTo(0, 0);
}
function updateCompleteUI() {
    const done = completedLessons.has(currentLessonId);
    completeBtn.disabled = done;
    completeStatus.classList.toggle("hidden", !done);
}
// ---- Events ----
subjectTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".subject-tab");
    if (!btn)
        return;
    activeSubject = btn.dataset.subject || "";
    renderTabs();
    renderGrid();
});
lessonGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".read-btn");
    if (!btn)
        return;
    const lessonId = btn.dataset.lesson || "";
    const file = btn.dataset.file || "";
    if (lessonId && file)
        showReader(lessonId, file);
});
backBtn.addEventListener("click", showBrowser);
completeBtn.addEventListener("click", async () => {
    var _a;
    if (!currentLessonId)
        return;
    completedLessons.add(currentLessonId);
    saveLocalProgress();
    updateCompleteUI();
    updateProgressUI();
    // Sync to Firebase
    const account = window.atomAccount;
    if (((_a = account === null || account === void 0 ? void 0 : account.getUser) === null || _a === void 0 ? void 0 : _a.call(account)) && account.saveLearnProgress) {
        try {
            await account.saveLearnProgress([...completedLessons]);
        }
        catch { }
    }
});
// ---- Nav toggle (hamburger) ----
const nav = document.getElementById("nav");
const overlay = document.getElementById("overlay");
const hamburger = document.getElementById("hamburger");
if (nav && overlay && hamburger) {
    hamburger.addEventListener("click", () => {
        nav.classList.toggle("open");
        overlay.classList.toggle("show");
        hamburger.classList.toggle("open");
    });
    overlay.addEventListener("click", () => {
        nav.classList.remove("open");
        overlay.classList.remove("show");
        hamburger.classList.remove("open");
    });
}
// ---- Init ----
async function init() {
    setupCopyProtection();
    // Load local progress
    const local = loadLocalProgress();
    local.forEach((id) => completedLessons.add(id));
    try {
        manifest = await loadManifest();
        renderTabs();
        renderGrid();
        updateProgressUI();
    }
    catch (err) {
        lessonGrid.innerHTML = `<div class="empty-state">Failed to load lessons. Please refresh.</div>`;
    }
    // Sync with Firebase when auth is ready
    const account = window.atomAccount;
    if (account === null || account === void 0 ? void 0 : account.onAuthChange) {
        account.onAuthChange(async (user) => {
            if (user) {
                await syncProgress();
                renderGrid();
                updateProgressUI();
            }
        });
    }
}
init();
//# sourceMappingURL=learn.js.map