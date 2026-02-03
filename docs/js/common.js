(() => {
  const SETTINGS_KEY = 'atom_settings_v1';
  const SETTINGS_DEFAULTS = {
    sfx: true,
    tts: true,
    div: 'MS',
    mode: 'rapid',
    highContrast: false,
    animations: true,
    fontSize: 'm',
    accent: '#4f7cff'
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
  }

  const settings = loadSettings();
  window.atomSettings = settings;
  applySettings(settings);

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
