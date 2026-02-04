    // NAV
    const nav = document.getElementById('nav');
    const overlay = document.getElementById('overlay');
    const hamburger = document.getElementById('hamburger');
    function toggleNav() {
      const isOpen = nav.classList.toggle('open');
      overlay.classList.toggle('show');
      hamburger.classList.toggle('open');
      hamburger.textContent = isOpen ? '✕' : '☰';
    }
    hamburger.addEventListener('click', toggleNav);
    overlay.addEventListener('click', toggleNav);

    // Settings model
    const DEFAULTS = {
      sfx: true,
      tts: true,
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

    const KEY = 'atom_settings_v1';

    function loadSettings() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
      } catch {
        return { ...DEFAULTS };
      }
    }

    function saveSettings(s) {
      localStorage.setItem(KEY, JSON.stringify(s));
    }

    function setToggle(el, on) {
      el.classList.toggle('on', !!on);
      el.setAttribute('aria-checked', String(!!on));
    }

    function readToggle(el) {
      return el.classList.contains('on');
    }

    function wireToggle(el) {
      const flip = () => setToggle(el, !readToggle(el));
      el.addEventListener('click', flip);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flip();
        }
      });
    }

    // Elements
    const sfxToggle = document.getElementById('sfxToggle');
    const ttsToggle = document.getElementById('ttsToggle');
    const hcToggle = document.getElementById('hcToggle');
    const animToggle = document.getElementById('animToggle');
    const rememberTopicsToggle = document.getElementById('rememberTopicsToggle');
    const autoCheckToggle = document.getElementById('autoCheckToggle');
    const autoThreshold = document.getElementById('autoThreshold');
    const autoThresholdValue = document.getElementById('autoThresholdValue');

    const divSelect = document.getElementById('divSelect');
    const modeSelect = document.getElementById('modeSelect');
    const fontSelect = document.getElementById('fontSelect');
    const accentSelect = document.getElementById('accentSelect');
    const themeSelect = document.getElementById('themeSelect');

    const toast = document.getElementById('toast');
    const applyBtn = document.getElementById('apply');
    const resetBtn = document.getElementById('reset');

    [sfxToggle, ttsToggle, hcToggle, animToggle, rememberTopicsToggle, autoCheckToggle].forEach(wireToggle);

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1200);
    }

    function applyThemePreview(s) {
      // Accent preview
      document.documentElement.style.setProperty('--accent', s.accent);

      // Font size preview
      const sizes = { s: '14px', m: '16px', l: '18px' };
      document.body.style.fontSize = sizes[s.fontSize] || '16px';

      // High contrast preview
      document.body.style.filter = s.highContrast ? 'contrast(1.06) saturate(1.02)' : 'none';

      // Theme preview
      if (s.theme === 'light') {
        document.documentElement.classList.add('theme-light');
      } else if (s.theme === 'dark') {
        document.documentElement.classList.remove('theme-light');
      } else {
        const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
        document.documentElement.classList.toggle('theme-light', !!prefersLight);
      }
    }

    function hydrateUI(s) {
      setToggle(sfxToggle, s.sfx);
      setToggle(ttsToggle, s.tts);
      setToggle(hcToggle, s.highContrast);
      setToggle(animToggle, s.animations);
      setToggle(rememberTopicsToggle, s.rememberTopics);
      setToggle(autoCheckToggle, s.autoCheck);
      autoThreshold.value = String(s.autoThreshold ?? 0.72);
      autoThresholdValue.textContent = Number(autoThreshold.value).toFixed(2);
      divSelect.value = s.div;
      modeSelect.value = s.mode;
      fontSelect.value = s.fontSize;
      accentSelect.value = s.accent;
      themeSelect.value = s.theme;
      applyThemePreview(s);
    }

    function collectUI() {
      return {
        sfx: readToggle(sfxToggle),
        tts: readToggle(ttsToggle),
        div: divSelect.value,
        mode: modeSelect.value,
        rememberTopics: readToggle(rememberTopicsToggle),
        autoCheck: readToggle(autoCheckToggle),
        autoThreshold: Number(autoThreshold.value),
        highContrast: readToggle(hcToggle),
        animations: readToggle(animToggle),
        fontSize: fontSelect.value,
        accent: accentSelect.value,
        theme: themeSelect.value
      };
    }

    // Live preview on dropdowns
    [fontSelect, accentSelect, themeSelect].forEach(el => {
      el.addEventListener('change', () => {
        const s = collectUI();
        applyThemePreview(s);
      });
    });
    hcToggle.addEventListener('click', () => applyThemePreview(collectUI()));
    autoThreshold.addEventListener('input', () => {
      autoThresholdValue.textContent = Number(autoThreshold.value).toFixed(2);
    });

    applyBtn.addEventListener('click', () => {
      const s = collectUI();
      saveSettings(s);
      applyThemePreview(s);
      showToast('Saved ✅');
    });

    resetBtn.addEventListener('click', () => {
      saveSettings({ ...DEFAULTS });
      hydrateUI({ ...DEFAULTS });
      showToast('Reset ✅');
    });

    // Init
    hydrateUI(loadSettings());
  
