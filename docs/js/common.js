(() => {
  const SETTINGS_KEY = 'atom_settings_v1';
  const SETTINGS_DEFAULTS = {
    sfx: true,
    tts: true,
    div: 'MS',
    mode: 'rapid',
    rememberTopics: false,
    highContrast: false,
    animations: true,
    fontSize: 'm',
    accent: '#4f7cff',
    theme: 'system'
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...SETTINGS_DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...SETTINGS_DEFAULTS, ...parsed };
    } catch {
      return { ...SETTINGS_DEFAULTS };
    }
  }

  function ensureNoAnimStyle() {
    if (document.getElementById('noAnimStyle')) return;
    const style = document.createElement('style');
    style.id = 'noAnimStyle';
    style.textContent = `
      .no-anim *, .no-anim *::before, .no-anim *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applySettings(s) {
    if (!s) return;
    ensureNoAnimStyle();
    document.documentElement.style.setProperty('--accent', s.accent);

    const sizes = { s: '14px', m: '16px', l: '18px' };
    document.body.style.fontSize = sizes[s.fontSize] || '16px';
    document.body.style.filter = s.highContrast ? 'contrast(1.06) saturate(1.02)' : 'none';
    document.documentElement.classList.toggle('no-anim', !s.animations);
    if (s.theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else if (s.theme === 'dark') {
      document.documentElement.classList.remove('theme-light');
    } else {
      const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
      document.documentElement.classList.toggle('theme-light', !!prefersLight);
    }
  }

  const settings = loadSettings();
  window.atomSettings = settings;
  applySettings(settings);

  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  if (mq?.addEventListener) {
    mq.addEventListener('change', () => {
      const next = loadSettings();
      if ((next.theme || 'system') === 'system') {
        applySettings(next);
      }
    });
  }

  function handleSameWindowNavigation(event) {
    const link = event.target.closest('a[href]');
    if (!link) return;
    if (link.target === '_blank') {
      link.target = '_self';
    }
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) {
      event.preventDefault();
      window.location.assign(url.href);
    }
  }

  document.addEventListener('click', handleSameWindowNavigation);
})();
