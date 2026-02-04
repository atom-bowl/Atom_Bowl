(function () {
  'use strict';

  function normalize(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(raw) {
    const normalized = normalize(raw);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
  }

  function jaccard(aTokens, bTokens) {
    if (!aTokens.length || !bTokens.length) return 0;
    const a = new Set(aTokens);
    const b = new Set(bTokens);
    let inter = 0;
    for (const t of a) if (b.has(t)) inter += 1;
    const union = a.size + b.size - inter;
    return union ? inter / union : 0;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j += 1) dp[j] = j;
    for (let i = 1; i <= m; i += 1) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j += 1) {
        const temp = dp[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prev + cost
        );
        prev = temp;
      }
    }
    return dp[n];
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen ? 1 - dist / maxLen : 0;
  }

  function extractChoiceLetter(raw) {
    if (!raw) return '';
    const match = String(raw).toUpperCase().match(/\b([WXYZ])\b\s*\)?/);
    return match ? match[1] : '';
  }

  function splitCandidates(raw) {
    const normalized = String(raw || '')
      .replace(/\bor\b/gi, '|')
      .replace(/\baccept\b/gi, '|')
      .replace(/\bany of the following\b/gi, '|')
      .replace(/[\/;]/g, '|');
    return normalized
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
  }

  function gradeShortAnswer(userAnswer, correctAnswer) {
    const user = normalize(userAnswer);
    const candidates = splitCandidates(correctAnswer).map(normalize).filter(Boolean);
    if (!user || !candidates.length) return { isCorrect: false, score: 0, matched: '' };

    const userTokens = tokenize(user);
    let best = { score: 0, matched: '' };

    for (const candidate of candidates) {
      const candTokens = tokenize(candidate);
      const tokenScore = jaccard(userTokens, candTokens);
      const editScore = similarity(user, candidate);
      const combined = Math.max(tokenScore, editScore) * 0.55 + Math.min(tokenScore, editScore) * 0.45;
      if (combined > best.score) {
        best = { score: combined, matched: candidate };
      }
    }

    const threshold = Math.max(0.72, candidates.length > 1 ? 0.68 : 0.72);
    return { isCorrect: best.score >= threshold, score: best.score, matched: best.matched };
  }

  function gradeMC(userAnswer, correctAnswer) {
    const user = extractChoiceLetter(userAnswer);
    const correct = extractChoiceLetter(correctAnswer);
    if (!user || !correct) return { isCorrect: false, score: 0 };
    return { isCorrect: user === correct, score: user === correct ? 1 : 0 };
  }

  function grade({ userAnswer, correctAnswer, questionType }) {
    if (String(questionType || '').toUpperCase() === 'MC') {
      return gradeMC(userAnswer, correctAnswer);
    }
    return gradeShortAnswer(userAnswer, correctAnswer);
  }

  window.autoChecker = { grade };
})();
