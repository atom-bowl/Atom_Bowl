(() => {
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

  function ensureHoverPillStyle() {
    if (document.getElementById('hoverPillStyle')) return;
    const style = document.createElement('style');
    style.id = 'hoverPillStyle';
    style.textContent = `
      .nav a[data-hover] {
        position: relative;
      }

      .nav a[data-hover]::after {
        content: attr(data-hover);
        position: absolute;
        left: calc(100% + 12px);
        top: 50%;
        transform: translateY(-50%) translateX(-6px);
        opacity: 0;
        pointer-events: none;
        padding: 6px 10px;
        border-radius: 10px;
        background: rgba(12,16,26,0.95);
        border: 1px solid rgba(255,255,255,0.12);
        color: var(--text);
        font-weight: 800;
        font-size: 0.75rem;
        letter-spacing: 0.02em;
        box-shadow: 0 10px 28px rgba(0,0,0,0.35);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .theme-light .nav a[data-hover]::after {
        background: rgba(255,255,255,0.95);
        border: 1px solid rgba(0,0,0,0.12);
        color: #0f172a;
        box-shadow: 0 8px 20px rgba(0,0,0,0.12);
      }

      .nav a[data-hover]:hover::after {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
      }

      @media (max-width: 820px) {
        .nav a[data-hover]::after {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureNavMoreStyle() {
    if (document.getElementById('navMoreStyle')) return;
    const style = document.createElement('style');
    style.id = 'navMoreStyle';
    style.textContent = `
      .nav-more {
        position: relative;
        margin-top: 12px;
      }

      .nav-more-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(18,24,36,0.6);
        color: var(--text);
        font-weight: 800;
        cursor: pointer;
        transition: background 0.2s ease, transform 0.15s ease;
      }

      .nav-more-btn:hover {
        background: rgba(79,124,255,0.18);
        transform: translateY(-1px);
      }

      .nav-more-menu {
        position: absolute;
        left: calc(100% + 12px);
        top: 50%;
        transform: translateY(-50%) translateX(-8px);
        opacity: 0;
        pointer-events: none;
        min-width: 180px;
        padding: 10px;
        border-radius: 12px;
        background: rgba(12,16,26,0.96);
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 12px 32px rgba(0,0,0,0.35);
        display: grid;
        gap: 8px;
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 1200;
      }

      .nav-more-menu a {
        text-decoration: none;
        color: var(--text);
        font-weight: 800;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(79,124,255,0.16);
      }

      .nav-more-soon {
        color: var(--muted);
        font-weight: 700;
        font-size: 0.85rem;
        padding: 6px 8px;
      }

      .nav-more.open .nav-more-menu,
      .nav-more:hover .nav-more-menu {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(-50%) translateX(0);
      }

      .theme-light .nav-more-btn {
        background: rgba(255,255,255,0.7);
        border: 1px solid rgba(0,0,0,0.08);
        color: #0f172a;
      }

      .theme-light .nav-more-menu {
        background: rgba(255,255,255,0.98);
        border: 1px solid rgba(0,0,0,0.12);
        box-shadow: 0 12px 28px rgba(0,0,0,0.12);
      }

      .theme-light .nav-more-menu a {
        color: #0f172a;
        background: rgba(79,124,255,0.12);
      }

      @media (max-width: 820px) {
        .nav-more-menu {
          position: static;
          transform: none;
          opacity: 1;
          pointer-events: auto;
          margin-top: 8px;
          box-shadow: none;
        }

        .nav-more-btn {
          justify-content: center;
        }
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
  ensureHoverPillStyle();
  ensureNavMoreStyle();

  const navMore = document.querySelector('[data-nav-more]');
  const navMoreBtn = navMore?.querySelector('.nav-more-btn');
  if (navMore && navMoreBtn) {
    navMoreBtn.addEventListener('click', (event) => {
      event.preventDefault();
      const isOpen = navMore.classList.toggle('open');
      navMoreBtn.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', (event) => {
      if (!navMore.contains(event.target)) {
        navMore.classList.remove('open');
        navMoreBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

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
