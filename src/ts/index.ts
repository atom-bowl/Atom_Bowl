type HomeQuestion = {
  set_name?: string;
  round_name?: string;
  num?: number;
  bonus?: boolean;
  level?: string;
  category?: string;
  type?: string;
  question_text?: string;
  parsed_answer?: string;
};

type Pair = {
  tossup: HomeQuestion;
  bonus: HomeQuestion;
};

type PdfLine = {
  text: string;
  font: 'F1' | 'F2' | 'F3';
  size: number;
  align: 'left' | 'center';
  gapAfter?: number;
};

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('nav') as HTMLElement | null;
  const overlay = document.getElementById('overlay') as HTMLElement | null;
  const hamburger = document.getElementById('hamburger') as HTMLElement | null;
  const startNowBtn = document.getElementById('startNowBtn') as HTMLButtonElement | null;
  const downloadPracticeSetBtn = document.getElementById('downloadPracticeSetBtn') as HTMLButtonElement | null;
  const homeActionStatus = document.getElementById('homeActionStatus') as HTMLElement | null;

  function setStatus(message: string, isError = false): void {
    if (!homeActionStatus) return;
    homeActionStatus.textContent = message;
    homeActionStatus.style.color = isError ? '#ff9f9f' : '';
  }

  function toggleNav(): void {
    if (!nav || !overlay || !hamburger) return;
    const isOpen = nav.classList.toggle('open');
    overlay.classList.toggle('show');
    hamburger.classList.toggle('open');
    hamburger.textContent = isOpen ? 'X' : '|||';
  }

  if (hamburger && overlay) {
    hamburger.addEventListener('click', toggleNav);
    overlay.addEventListener('click', toggleNav);
  }

  function go(page: string): void {
    if (window.atomNavigate) {
      window.atomNavigate(page);
      return;
    }
    window.location.href = page;
  }

  // Required by existing onclick handlers in index.html cards.
  window.go = go;

  function startNow(): void {
    const defaultRun = {
      mode: 'rapid',
      level: 'ANY',
      categories: [],
      detailedCategories: [],
      qaType: 'ANY',
      bonus: 'ANY',
      count: 25,
      seconds: 10,
      noTimer: true,
      setName: '',
      roundName: '',
      bankFile: 'data/set_B.json',
    };
    localStorage.setItem('atom_run', JSON.stringify(defaultRun));
    go('practice.html');
  }

  function pdfEscape(input: string): string {
    return input.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function wrapText(text: string, maxLen: number): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [''];
    const words = normalized.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }
      if ((current + ' ' + word).length <= maxLen) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function lineBlocks(label: string, text: string, maxLen: number): string[] {
    const chunks = text.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!chunks.length) return [label];
    const out: string[] = [];
    chunks.forEach((chunk, idx) => {
      const wrapped = wrapText(chunk, maxLen);
      wrapped.forEach((line, lineIdx) => {
        if (idx === 0 && lineIdx === 0) {
          out.push(`${label} ${line}`);
        } else {
          out.push(`   ${line}`);
        }
      });
    });
    return out;
  }

  function estimateTextWidth(text: string, size: number): number {
    return text.length * size * 0.48;
  }

  function buildRoundLines(questions: HomeQuestion[]): PdfLine[] {
    const lines: PdfLine[] = [];
    const now = new Date().toLocaleString();
    const meta = questions[0] || {};
    const roundName = meta.round_name && meta.round_name.toLowerCase() !== 'mixed'
      ? meta.round_name
      : 'Full Round';
    lines.push({ text: 'Atom Bowl Practice Set', font: 'F2', size: 20, align: 'center', gapAfter: 8 });
    lines.push({ text: `Round: ${roundName}`, font: 'F2', size: 13, align: 'center', gapAfter: 4 });
    lines.push({ text: `Generated: ${now}`, font: 'F1', size: 10, align: 'center', gapAfter: 14 });

    questions.forEach((q, idx) => {
      const qType = q.type || 'Q';
      const qBonus = q.bonus ? 'Bonus' : 'Toss-up';
      const qLevel = q.level || 'ANY';
      const qCategory = q.category || 'GENERAL SCIENCE';
      lines.push({ text: qCategory, font: 'F3', size: 13, align: 'center', gapAfter: 2 });
      lines.push({ text: `${idx + 1}. ${qType} | ${qBonus} | ${qLevel}`, font: 'F2', size: 11, align: 'left', gapAfter: 2 });
      lineBlocks('Q:', q.question_text || '', 95).forEach((line) => {
        lines.push({ text: line, font: 'F1', size: 10, align: 'left' });
      });
      lineBlocks('A:', q.parsed_answer || '', 95).forEach((line) => {
        lines.push({ text: line, font: 'F2', size: 10, align: 'left' });
      });
      lines.push({ text: '', font: 'F1', size: 10, align: 'left', gapAfter: 4 });
    });

    return lines;
  }

  function pickDivisionPopup(): Promise<'MS' | 'HS' | null> {
    return new Promise((resolve) => {
      const overlayEl = document.createElement('div');
      overlayEl.style.position = 'fixed';
      overlayEl.style.inset = '0';
      overlayEl.style.background = 'rgba(0,0,0,0.55)';
      overlayEl.style.display = 'flex';
      overlayEl.style.alignItems = 'center';
      overlayEl.style.justifyContent = 'center';
      overlayEl.style.zIndex = '2000';

      const modal = document.createElement('div');
      modal.style.width = 'min(92vw, 380px)';
      modal.style.background = '#121824';
      modal.style.color = '#e6eaf0';
      modal.style.border = '1px solid rgba(255,255,255,0.12)';
      modal.style.borderRadius = '14px';
      modal.style.padding = '18px';
      modal.style.boxShadow = '0 16px 40px rgba(0,0,0,0.45)';

      const title = document.createElement('div');
      title.textContent = 'Download Practice Set';
      title.style.fontSize = '1.05rem';
      title.style.fontWeight = '700';
      title.style.marginBottom = '8px';

      const subtitle = document.createElement('div');
      subtitle.textContent = 'Choose division for 25 TU/BO pairs:';
      subtitle.style.fontSize = '0.92rem';
      subtitle.style.color = '#9aa4b2';
      subtitle.style.marginBottom = '14px';

      const btnRow = document.createElement('div');
      btnRow.style.display = 'grid';
      btnRow.style.gridTemplateColumns = '1fr 1fr';
      btnRow.style.gap = '10px';
      btnRow.style.marginBottom = '10px';

      const msBtn = document.createElement('button');
      msBtn.type = 'button';
      msBtn.textContent = 'MS';
      msBtn.style.padding = '10px 12px';
      msBtn.style.borderRadius = '10px';
      msBtn.style.border = '1px solid rgba(79,124,255,0.45)';
      msBtn.style.background = 'rgba(79,124,255,0.22)';
      msBtn.style.color = '#e6eaf0';
      msBtn.style.fontWeight = '700';
      msBtn.style.cursor = 'pointer';

      const hsBtn = document.createElement('button');
      hsBtn.type = 'button';
      hsBtn.textContent = 'HS';
      hsBtn.style.padding = '10px 12px';
      hsBtn.style.borderRadius = '10px';
      hsBtn.style.border = '1px solid rgba(79,124,255,0.45)';
      hsBtn.style.background = 'rgba(79,124,255,0.22)';
      hsBtn.style.color = '#e6eaf0';
      hsBtn.style.fontWeight = '700';
      hsBtn.style.cursor = 'pointer';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.width = '100%';
      cancelBtn.style.padding = '9px 12px';
      cancelBtn.style.borderRadius = '10px';
      cancelBtn.style.border = '1px solid rgba(255,255,255,0.18)';
      cancelBtn.style.background = 'transparent';
      cancelBtn.style.color = '#c8d0db';
      cancelBtn.style.cursor = 'pointer';

      const cleanup = (result: 'MS' | 'HS' | null) => {
        overlayEl.remove();
        resolve(result);
      };

      msBtn.addEventListener('click', () => cleanup('MS'));
      hsBtn.addEventListener('click', () => cleanup('HS'));
      cancelBtn.addEventListener('click', () => cleanup(null));
      overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) cleanup(null);
      });

      btnRow.append(msBtn, hsBtn);
      modal.append(title, subtitle, btnRow, cancelBtn);
      overlayEl.append(modal);
      document.body.append(overlayEl);
    });
  }

  function makePdf(lines: PdfLine[]): Blob {
    const pageWidth = 612;
    const topY = 760;
    const bottomY = 50;
    const leftX = 45;
    const pages: string[] = [];
    let y = topY;
    let currentPageOps: string[] = [];

    function pushPage(): void {
      pages.push(currentPageOps.join('\n'));
      currentPageOps = [];
      y = topY;
    }

    lines.forEach((line) => {
      const lineHeight = line.size + 4 + (line.gapAfter || 0);
      if (y - lineHeight < bottomY && currentPageOps.length) {
        pushPage();
      }
      const width = estimateTextWidth(line.text, line.size);
      const x = line.align === 'center'
        ? Math.max(leftX, Math.round((pageWidth - width) / 2))
        : leftX;
      currentPageOps.push(`BT /${line.font} ${line.size} Tf ${x} ${y} Td (${pdfEscape(line.text)}) Tj ET`);
      y -= lineHeight;
    });

    if (currentPageOps.length) {
      pushPage();
    }

    const objects: string[] = [];
    const pageObjectIds: number[] = [];
    const pageCount = pages.length;
    const firstPageObjId = 3;
    const firstContentObjId = 4;
    const fontRegularId = firstPageObjId + pageCount * 2;
    const fontBoldId = fontRegularId + 1;
    const fontItalicId = fontRegularId + 2;

    pages.forEach((content, index) => {
      const pageId = firstPageObjId + index * 2;
      const contentId = firstContentObjId + index * 2;
      pageObjectIds.push(pageId);
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontItalicId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });

    objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    objects[fontItalicId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>';

    const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`;

    const header = '%PDF-1.4\n';
    let body = '';
    const offsets: number[] = [0];
    const totalObjects = fontItalicId;

    for (let id = 1; id <= totalObjects; id += 1) {
      offsets[id] = header.length + body.length;
      body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }

    const xrefOffset = header.length + body.length;
    let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= totalObjects; id += 1) {
      xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const pdf = header + body + xref + trailer;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  function chooseRoundPairs(bank: HomeQuestion[], division: 'MS' | 'HS'): HomeQuestion[] {
    const filtered = bank.filter((q) => (q.level || '').toUpperCase() === division);
    const pairs: Pair[] = [];
    let pendingTossup: HomeQuestion | null = null;

    filtered.forEach((q) => {
      if (q.bonus) {
        if (pendingTossup) {
          pairs.push({ tossup: pendingTossup, bonus: q });
          pendingTossup = null;
        }
        return;
      }
      pendingTossup = q;
    });

    if (pairs.length < 25) {
      throw new Error(`Not enough ${division} toss-up/bonus pairs in this bank.`);
    }

    const selectedPairs = pairs.slice(0, 25);
    const round: HomeQuestion[] = [];
    selectedPairs.forEach((pair) => {
      round.push(pair.tossup, pair.bonus);
    });
    return round;
  }

  async function downloadPracticeSet(): Promise<void> {
    if (!downloadPracticeSetBtn) return;
    downloadPracticeSetBtn.disabled = true;
    setStatus('Building practice set PDF...');

    try {
      const res = await fetch('./data/set_B.json', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Unable to load default question bank.');
      }
      const data = await res.json();
      const bank = Array.isArray(data) ? data : (Array.isArray(data?.questions) ? data.questions : []);
      if (!bank.length) {
        throw new Error('Question bank is empty.');
      }

      const division = await pickDivisionPopup();
      if (!division) {
        setStatus('Download canceled.');
        return;
      }

      const round = chooseRoundPairs(bank, division);
      if (!round.length) {
        throw new Error('Could not build a full round.');
      }

      const pdfBlob = makePdf(buildRoundLines(round));
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atom-bowl-practice-set.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`Downloaded ${division} set with 25 TU/BO pairs (${round.length} questions).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate PDF.';
      setStatus(message, true);
    } finally {
      downloadPracticeSetBtn.disabled = false;
    }
  }

  startNowBtn?.addEventListener('click', startNow);
  downloadPracticeSetBtn?.addEventListener('click', () => {
    void downloadPracticeSet();
  });
});
