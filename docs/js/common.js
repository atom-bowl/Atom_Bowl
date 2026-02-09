(() => {
    var _a;
    const SETTINGS_KEY = 'atom_settings_v1';
    const API_BASE_KEY = 'atom_api_base';
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
            if (!raw)
                return { ...SETTINGS_DEFAULTS };
            const parsed = JSON.parse(raw);
            return { ...SETTINGS_DEFAULTS, ...parsed };
        }
        catch {
            return { ...SETTINGS_DEFAULTS };
        }
    }
    function ensureNoAnimStyle() {
        if (document.getElementById('noAnimStyle'))
            return;
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
        if (document.getElementById('hoverPillStyle'))
            return;
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
        if (document.getElementById('navMoreStyle'))
            return;
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
        justify-content: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(18,24,36,0.6);
        color: var(--text);
        font-weight: 600;
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
        font-weight: 600;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(79,124,255,0.16);
        display: flex;
        align-items: center;
        gap: 10px;
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
    function ensureNavWeightStyle() {
        if (document.getElementById('navWeightStyle'))
            return;
        const style = document.createElement('style');
        style.id = 'navWeightStyle';
        style.textContent = `
      .nav a.active,
      .bottom-nav a.active {
        font-weight: 500;
      }

      .high-contrast .nav a.active,
      .high-contrast .bottom-nav a.active {
        font-weight: 700;
      }
    `;
        document.head.appendChild(style);
    }
    function ensureBottomMoreStyle() {
        if (document.getElementById('bottomMoreStyle'))
            return;
        const style = document.createElement('style');
        style.id = 'bottomMoreStyle';
        style.textContent = `
      .bottom-more {
        position: relative;
      }

      .bottom-more-btn {
        background: none;
        border: none;
        color: inherit;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font: inherit;
        cursor: pointer;
      }

      .bottom-more-btn .icon {
        line-height: 1;
        position: relative;
        top: 10px;
      }

      .bottom-more-menu {
        position: absolute;
        bottom: 56px;
        right: 0;
        min-width: 180px;
        padding: 8px;
        border-radius: 12px;
        background: rgba(12,16,26,0.96);
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 12px 28px rgba(0,0,0,0.35);
        display: none;
        flex-direction: column;
        gap: 6px;
        z-index: 1200;
      }

      .bottom-more-menu a {
        text-decoration: none;
        color: var(--text);
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(79,124,255,0.16);
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
      }

      .bottom-more.open .bottom-more-menu {
        display: flex;
      }

      .theme-light .bottom-more-menu {
        background: rgba(255,255,255,0.98);
        border: 1px solid rgba(0,0,0,0.12);
        box-shadow: 0 12px 28px rgba(0,0,0,0.12);
      }

      .theme-light .bottom-more-menu a {
        color: #0f172a;
        background: rgba(79,124,255,0.12);
      }

      @media (max-width: 820px) {
        .bottom-more-btn span:last-child {
          display: none;
        }

        .bottom-more-menu a span:not(.icon) {
          display: inline;
        }
      }
    `;
        document.head.appendChild(style);
    }
    function ensureBottomNavPinnedStyle() {
        if (document.getElementById('bottomNavPinnedStyle'))
            return;
        const style = document.createElement('style');
        style.id = 'bottomNavPinnedStyle';
        style.textContent = `
      .bottom-nav {
        position: fixed !important;
        left: 12px !important;
        right: 12px !important;
        bottom: 12px !important;
        z-index: 1200;
      }

      @media (max-width: 820px) {
        .bottom-nav {
          padding: 10px 12px !important;
          border-radius: 22px !important;
          gap: 8px !important;
        }

        .bottom-nav a {
          font-size: 0.75rem !important;
          padding: 8px 6px !important;
          gap: 4px !important;
        }

        .bottom-nav a .icon {
          font-size: 1.15rem !important;
        }
      }
    `;
        document.head.appendChild(style);
    }
    function ensurePageTransitionStyle() {
        if (document.getElementById('pageTransitionStyle'))
            return;
        const style = document.createElement('style');
        style.id = 'pageTransitionStyle';
        style.textContent = `
      .page-shell {
        transition: opacity 0.18s ease, transform 0.18s ease;
        will-change: opacity, transform;
        width: 100%;
        min-height: 100vh;
        overflow-x: hidden;
        position: relative;
      }

      .page-leave .page-shell {
        opacity: 0;
        transform: translateX(-18px);
      }

      .page-enter .page-shell {
        opacity: 0;
        transform: translateX(18px);
        transition-duration: 0.32s;
      }
    `;
        document.head.appendChild(style);
    }
    function applySettings(s) {
        var _a;
        if (!s)
            return;
        ensureNoAnimStyle();
        document.documentElement.style.setProperty('--accent', s.accent);
        const sizes = { s: '14px', m: '16px', l: '18px' };
        document.body.style.fontSize = sizes[s.fontSize] || '16px';
        document.body.style.filter = s.highContrast ? 'contrast(1.06) saturate(1.02)' : 'none';
        document.documentElement.classList.toggle('high-contrast', !!s.highContrast);
        document.documentElement.classList.toggle('no-anim', !s.animations);
        if (s.theme === 'light') {
            document.documentElement.classList.add('theme-light');
        }
        else if (s.theme === 'dark') {
            document.documentElement.classList.remove('theme-light');
        }
        else {
            const prefersLight = (_a = window.matchMedia) === null || _a === void 0 ? void 0 : _a.call(window, '(prefers-color-scheme: light)').matches;
            document.documentElement.classList.toggle('theme-light', !!prefersLight);
        }
    }
    const settings = loadSettings();
    window.atomSettings = settings;
    applySettings(settings);
    ensureHoverPillStyle();
    ensureNavMoreStyle();
    ensureNavWeightStyle();
    ensureBottomMoreStyle();
    ensureBottomNavPinnedStyle();
    ensurePageTransitionStyle();
    function ensurePageShell() {
        if (!document.body)
            return;
        if (document.querySelector('.page-shell'))
            return;
        const shell = document.createElement('div');
        shell.className = 'page-shell';
        const children = Array.from(document.body.childNodes);
        children.forEach((node) => {
            if (!(node instanceof Element))
                return;
            if (node.tagName === 'SCRIPT')
                return;
            if (node.classList.contains('bottom-nav'))
                return;
            if (node.classList.contains('nav'))
                return;
            if (node.classList.contains('overlay'))
                return;
            if (node.classList.contains('hamburger'))
                return;
            if (node.classList.contains('topbar'))
                return;
            shell.appendChild(node);
        });
        document.body.insertBefore(shell, document.body.firstChild);
    }
    if (document.body) {
        document.body.classList.add('page-transition');
        ensurePageShell();
    }
    function finishPageEnter() {
        if (!document.body)
            return;
        if (!document.body.classList.contains('page-enter'))
            return;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                document.body.classList.remove('page-enter');
            });
        });
    }
    finishPageEnter();
    function navigateWithFade(url) {
        if (!url)
            return;
        if (document.documentElement.classList.contains('no-anim')) {
            window.location.assign(url);
            return;
        }
        if (document.body) {
            document.body.classList.add('page-transition');
            document.body.classList.add('page-leave');
        }
        window.setTimeout(() => window.location.assign(url), 180);
    }
    window.atomNavigate = navigateWithFade;
    const navMore = document.querySelector('[data-nav-more]');
    const navMoreBtn = navMore === null || navMore === void 0 ? void 0 : navMore.querySelector('.nav-more-btn');
    if (navMore && navMoreBtn) {
        navMoreBtn.innerHTML = '<span class="icon">&#8942;</span><span>More Tools</span>';
        const menuLinks = navMore.querySelectorAll('.nav-more-menu a');
        menuLinks.forEach((link) => {
            const href = link.getAttribute('href') || '';
            if (href.includes('game_clock.html')) {
                link.innerHTML = '<span class="icon">&#9201;</span><span>Game Clock</span>';
            }
            if (href.includes('buzzer_rooms.html')) {
                link.innerHTML = '<span class="icon">&#128680;</span><span>Buzzer Rooms</span>';
            }
        });
        navMoreBtn.addEventListener('click', (event) => {
            event.preventDefault();
            const isOpen = navMore.classList.toggle('open');
            navMoreBtn.setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!target || !navMore.contains(target)) {
                navMore.classList.remove('open');
                navMoreBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
    function ensureAccountLink() {
        const nav = document.querySelector('.nav');
        if (!nav)
            return null;
        let link = nav.querySelector('a[href*="account.html"]');
        if (link)
            return link;
        const settingsLink = nav.querySelector('a[href*="settings.html"]');
        link = document.createElement('a');
        link.href = 'account.html';
        link.className = 'nav-account';
        link.innerHTML = '<span class="icon">&#128100;</span><span class="label">Sign in</span>';
        if (settingsLink && settingsLink.parentElement === nav) {
            settingsLink.insertAdjacentElement('afterend', link);
        }
        else {
            nav.appendChild(link);
        }
        const path = window.location.pathname || '';
        if (path.endsWith('account.html')) {
            link.classList.add('active');
        }
        return link;
    }
    function updateAccountLinkLabel(link, user) {
        if (!link)
            return;
        const label = link.querySelector('.label');
        if (!label)
            return;
        if (user) {
            const name = user.displayName || user.email || 'Account';
            label.textContent = String(name || 'Account');
        }
        else {
            label.textContent = 'Sign in';
        }
    }
    function resolveApiBase() {
        let base = '';
        try {
            const params = new URLSearchParams(window.location.search);
            const fromQuery = (params.get('api') || params.get('apiBase') || '').trim();
            if (fromQuery) {
                base = fromQuery;
                localStorage.setItem(API_BASE_KEY, base);
            }
            if (!base) {
                const stored = (localStorage.getItem(API_BASE_KEY) || '').trim();
                if (stored)
                    base = stored;
            }
            if (!base) {
                const host = window.location.hostname || '';
                const isLocalHost = host === 'localhost' || host === '127.0.0.1';
                if (!isLocalHost) {
                    base = 'https://atom-bowl.onrender.com';
                }
            }
        }
        catch { }
        window.ATOM_API_BASE = base;
    }
    resolveApiBase();
    async function bindAccountNav() {
        const link = ensureAccountLink();
        try {
            await import('./account_store.js');
        }
        catch {
            return;
        }
        const account = window.atomAccount;
        if (!(account === null || account === void 0 ? void 0 : account.onAuthChange))
            return;
        account.onAuthChange((user) => updateAccountLinkLabel(link, user));
    }
    bindAccountNav();
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        const gameClockLink = bottomNav.querySelector('a[href*="game_clock.html"]');
        if (gameClockLink) {
            const moreWrap = document.createElement('div');
            moreWrap.className = 'bottom-more';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bottom-more-btn';
            btn.setAttribute('aria-haspopup', 'true');
            btn.setAttribute('aria-expanded', 'false');
            btn.innerHTML = '<span class="icon">&#8942;</span><span>More</span>';
            const menu = document.createElement('div');
            menu.className = 'bottom-more-menu';
            menu.innerHTML = `
        <a href="game_clock.html"><span class="icon">&#9201;</span><span>Game Clock</span></a>
        <a href="buzzer_rooms.html"><span class="icon">&#128680;</span><span>Buzzer Rooms</span></a>
        <a href="account.html"><span class="icon">&#128100;</span><span>Account</span></a>
        `;
            moreWrap.appendChild(btn);
            moreWrap.appendChild(menu);
            gameClockLink.replaceWith(moreWrap);
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const isOpen = moreWrap.classList.toggle('open');
                btn.setAttribute('aria-expanded', String(isOpen));
            });
            document.addEventListener('click', (event) => {
                const target = event.target;
                if (!target || !moreWrap.contains(target)) {
                    moreWrap.classList.remove('open');
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }
    const mq = (_a = window.matchMedia) === null || _a === void 0 ? void 0 : _a.call(window, '(prefers-color-scheme: light)');
    if (mq === null || mq === void 0 ? void 0 : mq.addEventListener) {
        mq.addEventListener('change', () => {
            const next = loadSettings();
            if ((next.theme || 'system') === 'system') {
                applySettings(next);
            }
        });
    }
    function handleSameWindowNavigation(event) {
        if (event.defaultPrevented)
            return;
        if (event.button !== 0)
            return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const target = event.target;
        const link = target === null || target === void 0 ? void 0 : target.closest('a[href]');
        if (!link)
            return;
        if (link.target === '_blank') {
            link.target = '_self';
        }
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin)
            return;
        const samePage = url.pathname === window.location.pathname
            && url.search === window.location.search
            && url.hash;
        if (samePage)
            return;
        event.preventDefault();
        navigateWithFade(url.href);
    }
    document.addEventListener('click', handleSameWindowNavigation);
})();
//# sourceMappingURL=common.js.map