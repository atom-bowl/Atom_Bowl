(() => {
  type PracticeScoreStats = {
    answered: number;
    correct: number;
    totalTime: number;
    slowCorrect: number;
  };

  function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function safeRatio(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return numerator / denominator;
  }

  function toFinite(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }

  function compute(stats: PracticeScoreStats): number {
    const answered = Math.max(0, Math.floor(toFinite(stats.answered)));
    const correct = Math.max(0, Math.floor(toFinite(stats.correct)));
    const slowCorrect = Math.max(0, Math.floor(toFinite(stats.slowCorrect)));
    const totalTime = Math.max(0, toFinite(stats.totalTime));

    if (answered <= 0) return 0;

    const accuracy = clamp(safeRatio(correct, answered), 0, 1);
    const avgTime = safeRatio(totalTime, answered);
    const slowRate = clamp(safeRatio(slowCorrect, Math.max(correct, 1)), 0, 1);

    const accuracyComponent = Math.pow(accuracy, 1.65) * 72;

    const speedNorm = clamp((12 - avgTime) / 12, 0, 1);
    const speedCurve = Math.sqrt(speedNorm);
    const speedStability = Math.log1p(1 + (speedNorm * 9)) / Math.log(11);
    const speedComponent = ((speedCurve * 0.55) + (speedStability * 0.45)) * 18;

    const consistencyBase = 1 - Math.pow(slowRate, 0.85);
    const consistencyPenalty = Math.min(8, slowCorrect * 0.45);
    const consistencyComponent = clamp((consistencyBase * 12) - consistencyPenalty, 0, 12);

    const sampleTrust = clamp(Math.log1p(answered) / Math.log(26), 0, 1);
    const trustMultiplier = 0.9 + (sampleTrust * 0.1);

    const rawScore = (accuracyComponent + speedComponent + consistencyComponent) * trustMultiplier;
    return clamp(rawScore, 0, 100);
  }

  window.atomScoreEngine = { compute };
})();
