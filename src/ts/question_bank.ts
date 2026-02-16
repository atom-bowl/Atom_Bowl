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

    const grid = document.getElementById('grid');
    const statusEl = document.getElementById('status');
    const errEl = document.getElementById('err');
    const countEl = document.getElementById('count');
    const searchEl = document.getElementById('search');
    const bankSelectEl = document.getElementById('bankSelect');
    const levelEl = document.getElementById('level');
    const categoryEl = document.getElementById('category');
    const bonusEl = document.getElementById('bonus');

    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const pageEl = document.getElementById('page');
    const pagesEl = document.getElementById('pages');

    let bank = [];
    let filtered = [];
    let useServer = false;
    let serverItems = [];
    let serverTotal = 0;
    let page = 1;
    const PAGE_SIZE = 100; // keeps it fast; still feels like infinite scroll because pages are huge
    const API_BASE = (window as any).ATOM_API_BASE || '';

    function apiUrl(path: string) {
      if (!API_BASE) return path;
      return `${API_BASE.replace(/\/+$/, '')}${path}`;
    }

    function norm(s) { return String(s || '').trim(); }

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }

    function hideErr() {
      errEl.style.display = 'none';
      errEl.textContent = '';
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

    async function loadBank() {
      const sources = [
        { id: 'data/set_A.json', label: 'Dynamazar (Set A)' },
        { id: 'data/set_B.json', label: 'Scalazar (Set B)' }
      ];

      const results = await Promise.all(sources.map(async (source) => {
        const res = await fetch(`./${source.id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${source.id} not found in /data`);
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.questions || []);
        return items.map((q) => ({ ...q, bank_id: source.id, bank_label: source.label }));
      }));

      return results.flat();
    }

    function matches(q, search, bankChoice, level, category, bonus) {
      if (bankChoice !== 'ALL' && q.bank_id !== bankChoice) return false;
      if (level !== 'ANY' && q.level !== level) return false;
      if (category !== 'ANY' && norm(q.category) !== category) return false;
      if (bonus !== 'ANY' && String(!!q.bonus) !== String(bonus)) return false;

      if (!search) return true;
      const s = search.toLowerCase();
      const hay = [
        q.set_name,
        q.round_name,
        q.category,
        q.type,
        q.parsed_answer,
        q.question_text,
        q.answer_text,
        q.page,
        q.num
      ].map(v => String(v || '')).join(' | ').toLowerCase();
      return hay.includes(s);
    }

    async function serverSearch() {
      const search = norm(searchEl.value);
      const bankChoice = bankSelectEl.value;
      const level = levelEl.value;
      const category = categoryEl.value;
      const bonus = bonusEl.value;

      const params = new URLSearchParams({
        search,
        bank: bankChoice,
        level,
        category,
        bonus,
        page: String(page),
        pageSize: String(PAGE_SIZE)
      });

      const res = await fetch(apiUrl(`/api/search?${params.toString()}`), { cache: 'no-store' });
      if (!res.ok) throw new Error('Server search failed.');
      const data = await res.json();
      serverItems = Array.isArray(data.items) ? data.items : [];
      serverTotal = Number(data.total || 0);
    }

    async function apply() {
      const search = norm(searchEl.value);
      const bankChoice = bankSelectEl.value;
      const level = levelEl.value;
      const category = categoryEl.value;
      const bonus = bonusEl.value;

      page = 1;
      if (useServer) {
        try {
          await serverSearch();
          render();
        } catch (e) {
          useServer = false;
          filtered = bank.filter(q => matches(q, search, bankChoice, level, category, bonus));
          render();
        }
        return;
      }

      filtered = bank.filter(q => matches(q, search, bankChoice, level, category, bonus));
      render();
    }

    function tag(text, cls = '') {
      return `<span class="tag ${cls}">${text}</span>`;
    }

    function render() {
      hideErr();

      const total = useServer ? serverTotal : filtered.length;
      countEl.textContent = String(total);

      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      page = Math.max(1, Math.min(totalPages, page));
      pageEl.textContent = String(page);
      pagesEl.textContent = String(totalPages);

      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= totalPages;

      const start = (page - 1) * PAGE_SIZE;
      const slice = useServer ? serverItems : filtered.slice(start, start + PAGE_SIZE);

      grid.innerHTML = slice.map((q, i) => {
        const isBonus = !!q.bonus;
        const lvl = q.level || '—';
        const cat = norm(q.category) || '—';
        const type = q.type || '—';

        const id = useServer ? `${i}` : `${start + i}`; // server uses page-local index

        return `
          <div class="tile pop">
            <div class="tagrow">
              ${tag(lvl, 'accent')}
              ${tag(cat)}
              ${tag(isBonus ? 'BONUS' : 'TOSS-UP', isBonus ? 'bad' : 'good')}
              ${tag(type)}
            </div>

            <div class="qtitle">${escapeHtml(q.set_name || 'Set')} • ${escapeHtml(q.round_name || 'Round')} • #${escapeHtml(q.num)}</div>
            <div class="qmeta">Answer: <b>${escapeHtml(q.parsed_answer || '—')}</b></div>

            <div class="btnrow">
              <button class="btn practice" data-action="practice" data-idx="${id}">Practice</button>
              <button class="btn tutor" data-action="tutor" data-idx="${id}">Tutor</button>
            </div>
          </div>
        `;
      }).join('');

      statusEl.textContent = total
        ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}.`
        : 'No results. Try changing filters.';
    }

    function escapeHtml(s) {
      return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    // Click handling
    grid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button[data-action]') as HTMLElement | null;
      if (!btn) return;

      const idx = parseInt(btn.dataset.idx, 10);
      const q = useServer ? serverItems[idx] : filtered[idx];
      if (!q) return;

      if (btn.dataset.action === 'practice') {
        // Send selected question to the engine
        localStorage.setItem('atom_single_question', JSON.stringify(q));
        localStorage.setItem('atom_practice_config', JSON.stringify({
          mode: 'single',
          count: 1
        }));
        window.location.href = 'practice.html';
      }

      if (btn.dataset.action === 'tutor') {
        // Placeholder: wired later to Gemini
        window.location.href = 'tutor.html';
      }
    });

    // Controls
    const debounced = (() => {
      let t = null;
      return (fn) => {
        clearTimeout(t);
        t = setTimeout(fn, 160);
      };
    })();

    searchEl.addEventListener('input', () => debounced(apply));
    bankSelectEl.addEventListener('change', apply);
    levelEl.addEventListener('change', apply);
    categoryEl.addEventListener('change', apply);
    bonusEl.addEventListener('change', apply);

    prevBtn.addEventListener('click', async () => {
      page -= 1;
      if (useServer) {
        await serverSearch();
      }
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', async () => {
      page += 1;
      if (useServer) {
        await serverSearch();
      }
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    (async () => {
      statusEl.textContent = 'Loading question banks…';
      useServer = await checkServer();

      if (useServer) {
        try {
          await serverSearch();
          statusEl.textContent = 'Loaded via server search.';
          render();
          return;
        } catch (e) {
          useServer = false;
        }
      }

      try {
        bank = await loadBank();
      } catch (e) {
        showErr(String(e.message || e));
        statusEl.textContent = '';
        return;
      }

      // Basic sanity
      if (!Array.isArray(bank) || bank.length === 0) {
        showErr('data/set_A.json loaded but contains no questions.');
        statusEl.textContent = '';
        return;
      }

      statusEl.textContent = `Loaded ${bank.length} questions from both banks.`;
      filtered = bank.slice();
      render();
    })();
  




})();
