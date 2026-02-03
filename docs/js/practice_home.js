    // Everything waits for DOM so we never attach listeners to null nodes.
    document.addEventListener('DOMContentLoaded', () => {
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

      // Filters
      const els = {
        bankSelect: document.getElementById('bankSelect'),
        level: document.getElementById('level'),
        category: document.getElementById('category'),
        qaType: document.getElementById('qaType'),
        bonus: document.getElementById('bonus'),
        count: document.getElementById('count'),
        seconds: document.getElementById('seconds'),
        setName: document.getElementById('setName'),
        roundName: document.getElementById('roundName'),
        bankStatus: document.getElementById('bankStatus'),
        bankMeta: document.getElementById('bankMeta'),
        countRapid: document.getElementById('countRapid'),
        countToss: document.getElementById('countToss'),
        countBonus: document.getElementById('countBonus'),
        countMC: document.getElementById('countMC'),
        countSA: document.getElementById('countSA'),
        countSet: document.getElementById('countSet'),
      };

      // Minimal self-tests (console only)
      console.assert(!!els.level && !!els.category && !!els.qaType && !!els.bonus, 'Missing core filter elements');
      console.assert(!!els.countRapid && !!els.bankStatus, 'Missing status/count elements');

      let bank = [];

      function normCat(c) { return String(c || '').trim(); }

      
      function applyFilters(list, overrides = {}) {
        const level = overrides.level ?? els.level.value;
        const category = overrides.category ?? els.category.value;
        const qaType = overrides.qaType ?? els.qaType.value;
        const bonus = overrides.bonus ?? els.bonus.value;
        const setName = (overrides.setName ?? els.setName.value).trim();
        const roundName = (overrides.roundName ?? els.roundName.value).trim();

        return list.filter(q => {
          if (level !== 'ANY' && q.level !== level) return false;
          if (category !== 'ANY' && normCat(q.category) !== category) return false;
          if (qaType !== 'ANY' && q.type !== qaType) return false;
          if (bonus !== 'ANY' && String(!!q.bonus) !== bonus) return false;
          if (setName && q.set_name !== setName) return false;
          if (roundName && q.round_name !== roundName) return false;
          return true;
        });
      }

      function updateCounts() {
        const base = applyFilters(bank);
        els.countRapid.textContent = `${base.length.toLocaleString()} matches`;
        els.countToss.textContent = `${applyFilters(bank, { bonus: 'false' }).length.toLocaleString()} matches`;
        els.countBonus.textContent = `${applyFilters(bank, { bonus: 'true' }).length.toLocaleString()} matches`;
        els.countMC.textContent = `${applyFilters(bank, { qaType: 'MC' }).length.toLocaleString()} matches`;
        els.countSA.textContent = `${applyFilters(bank, { qaType: 'SA' }).length.toLocaleString()} matches`;
        els.countSet.textContent = `${applyFilters(bank).length.toLocaleString()} matches`;
      }

      function getRunConfig(mode) {
        const cfg = {
          mode,
          level: els.level.value,
          category: els.category.value,
          qaType: els.qaType.value,
          bonus: els.bonus.value,
          count: Math.max(1, parseInt(els.count.value || '25', 10)),
          seconds: Math.max(5, Math.min(30, parseInt(els.seconds.value || '10', 10))),
          noTimer: document.getElementById('noTimerCheck').checked,
          setName: els.setName.value.trim(),
          roundName: els.roundName.value.trim(),
          bankFile: els.bankSelect.value,
        };

        // Tile-specific rules
        if (mode === 'tossups') cfg.bonus = 'false';
        if (mode === 'bonuses') cfg.bonus = 'true';
        if (mode === 'wxyz') cfg.qaType = 'MC';
        if (mode === 'sa') cfg.qaType = 'SA';

        return cfg;
      }

      // Expose startRun for onclick tiles
      window.startRun = function startRun(mode) {
        localStorage.setItem('atom_run', JSON.stringify(getRunConfig(mode)));
        window.location.href = 'practice.html';
      };

      async function loadBank() {
        const selectedBank = els.bankSelect?.value || 'data/set_A.json';
        const normalizedBank = selectedBank.replace(/^\.\/+/, '');
        try {
          els.bankStatus.textContent = 'Loading…';
          const res = await fetch(`./${normalizedBank}`, { cache: 'no-store' });
          if (!res.ok) throw new Error('data/set_A.json not found');
          const data = await res.json();
          bank = Array.isArray(data) ? data : (data.questions || []);

          els.bankStatus.textContent = 'Ready';
          els.bankStatus.style.background = 'rgba(57,217,138,0.14)';
          els.bankStatus.style.borderColor = 'rgba(57,217,138,0.24)';
          els.bankMeta.textContent = `${normalizedBank} • ${bank.length.toLocaleString()} questions detected`;

          updateCounts();
        } catch (e) {
          els.bankStatus.textContent = 'Missing';
          els.bankStatus.style.background = 'rgba(255,107,107,0.14)';
          els.bankStatus.style.borderColor = 'rgba(255,107,107,0.22)';
          els.bankMeta.textContent = 'Put the sets in docs/data (data/ on the site).';
          bank = [];
          updateCounts();
        }
      }

      // Live counts
      const watch = [els.level, els.qaType, els.bonus, els.count, els.seconds, els.setName, els.roundName];
      for (const el of watch) {
        // Some are inputs, some are selects
        el.addEventListener('change', updateCounts);
        el.addEventListener('input', updateCounts);
      }
      els.category.addEventListener('change', updateCounts);

      els.bankSelect.addEventListener('change', () => {
        loadBank();
      });

      loadBank();
    });
  
