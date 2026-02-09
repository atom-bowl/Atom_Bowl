(() => {
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

    async function syncAccountSettings(s) {
      if (!window.atomAccount) {
        try {
          await import('./account_store.js');
        } catch {
          return;
        }
      }
      try {
        await window.atomAccount?.saveSettings?.(s);
      } catch {}
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
    const voiceSelect = document.getElementById('voiceSelect');
    const voiceRate = document.getElementById('voiceRate');
    const voiceRateValue = document.getElementById('voiceRateValue');
    const voicePitch = document.getElementById('voicePitch');
    const voicePitchValue = document.getElementById('voicePitchValue');
    const voiceVolume = document.getElementById('voiceVolume');
    const voiceVolumeValue = document.getElementById('voiceVolumeValue');
    const voiceTest = document.getElementById('voiceTest');

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
      if (voiceSelect) voiceSelect.value = s.ttsVoice || '';
      if (voiceRate) {
        voiceRate.value = String(s.ttsRate ?? 1.0);
        voiceRateValue.textContent = `${Number(voiceRate.value).toFixed(2)}x`;
      }
      if (voicePitch) {
        voicePitch.value = String(s.ttsPitch ?? 1.0);
        voicePitchValue.textContent = Number(voicePitch.value).toFixed(2);
      }
      if (voiceVolume) {
        voiceVolume.value = String(s.ttsVolume ?? 1.0);
        voiceVolumeValue.textContent = `${Math.round(Number(voiceVolume.value) * 100)}%`;
      }
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
        ttsVoice: voiceSelect?.value || '',
        ttsRate: Number(voiceRate?.value ?? 1.0),
        ttsPitch: Number(voicePitch?.value ?? 1.0),
        ttsVolume: Number(voiceVolume?.value ?? 1.0),
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
    if (voiceRate) {
      voiceRate.addEventListener('input', () => {
        voiceRateValue.textContent = `${Number(voiceRate.value).toFixed(2)}x`;
      });
    }
    if (voicePitch) {
      voicePitch.addEventListener('input', () => {
        voicePitchValue.textContent = Number(voicePitch.value).toFixed(2);
      });
    }
    if (voiceVolume) {
      voiceVolume.addEventListener('input', () => {
        voiceVolumeValue.textContent = `${Math.round(Number(voiceVolume.value) * 100)}%`;
      });
    }

    function populateVoices(s) {
      if (!voiceSelect) return;
      if (!window.speechSynthesis) {
        voiceSelect.innerHTML = '<option value="">Voice not supported</option>';
        voiceSelect.disabled = true;
        return;
      }

      const voices = window.speechSynthesis.getVoices();
      voiceSelect.disabled = false;
      voiceSelect.innerHTML = '';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'System default';
      voiceSelect.appendChild(defaultOption);

      voices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.voiceURI || voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
      });

      if (s.ttsVoice && [...voiceSelect.options].some(opt => opt.value === s.ttsVoice)) {
        voiceSelect.value = s.ttsVoice;
      } else {
        voiceSelect.value = '';
      }
    }

    function buildTestUtterance() {
      if (!window.speechSynthesis) return null;
      const u = new SpeechSynthesisUtterance('This is a test of your Atom Bowl voice settings.');
      u.rate = Number(voiceRate?.value ?? 1.0);
      u.pitch = Number(voicePitch?.value ?? 1.0);
      u.volume = Number(voiceVolume?.value ?? 1.0);

      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => (v.voiceURI || v.name) === (voiceSelect?.value || ''));
      if (match) u.voice = match;
      return u;
    }

    if (voiceTest) {
      voiceTest.addEventListener('click', () => {
        if (!window.speechSynthesis) {
          showToast('Voice not supported');
          return;
        }
        window.speechSynthesis.cancel();
        const u = buildTestUtterance();
        if (!u) return;
        window.speechSynthesis.speak(u);
      });
    }

    applyBtn.addEventListener('click', () => {
      const s = collectUI();
      saveSettings(s);
      syncAccountSettings(s);
      applyThemePreview(s);
      showToast('Saved ✅');
    });

    resetBtn.addEventListener('click', () => {
      const next = { ...DEFAULTS };
      saveSettings(next);
      syncAccountSettings(next);
      hydrateUI(next);
      showToast('Reset ✅');
    });

    // Init
    const initial = loadSettings();
    hydrateUI(initial);
    populateVoices(initial);
    if (window.speechSynthesis?.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        populateVoices(loadSettings());
      });
    }

    document.addEventListener('atomSettingsSynced', (event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail) return;
      hydrateUI(detail);
      applyThemePreview(detail);
    });
  

})();
