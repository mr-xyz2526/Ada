const clamp = (num, min, max) => Math.max(min, Math.min(max, num));

const average = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const variance = (arr) => {
  if (!arr.length) return 0;
  const avg = average(arr);
  return average(arr.map((v) => (v - avg) ** 2));
};

const pctChange = (first, last) => {
  if (!first) return 0;
  return ((last - first) / first) * 100;
};

const getTrendSlope = (values) => {
  const n = values.length;
  if (n < 2) return 0;

  const xAvg = (n - 1) / 2;
  const yAvg = average(values);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xAvg) * (values[i] - yAvg);
    den += (i - xAvg) ** 2;
  }

  return den ? num / den : 0;
};

function computeIndicators(weeklyData) {
  const attendance = weeklyData.map((w) => Number(w.attendance_rate));
  const delays = weeklyData.map((w) => Number(w.assignment_delay_hours));
  const missedDeadlines = weeklyData.map((w) => Number(w.deadlines_missed));
  const performance = weeklyData.map((w) => Number(w.performance_score));

  const attendanceConsistencyScore = clamp(average(attendance) - Math.sqrt(variance(attendance)), 0, 100);

  const delaySlope = getTrendSlope(delays);
  const assignmentDelayTrend = delaySlope > 0.6 ? 'increasing' : delaySlope < -0.6 ? 'decreasing' : 'stable';

  const deadlineMissFrequency = average(missedDeadlines);
  const performanceStabilityIndex = clamp(100 - Math.sqrt(variance(performance)) * 4, 0, 100);

  const attendanceDropPct = -pctChange(attendance[0], attendance[attendance.length - 1]);
  const performanceDropPct = -pctChange(performance[0], performance[performance.length - 1]);

  // Weighted risk score (0-100)
  const riskScore = clamp(
    (100 - attendanceConsistencyScore) * 0.3 +
      clamp(delaySlope * 8 + average(delays), 0, 100) * 0.25 +
      clamp(deadlineMissFrequency * 25, 0, 100) * 0.25 +
      (100 - performanceStabilityIndex) * 0.2,
    0,
    100,
  );

  const anomalies = [];
  weeklyData.forEach((row, idx) => {
    if (Number(row.deadlines_missed) >= 3 || Number(row.assignment_delay_hours) >= 72) {
      anomalies.push({
        weekStart: row.week_start,
        reason: 'Unusually high missed deadlines or assignment delay',
      });
    }
    if (idx > 0 && Number(weeklyData[idx - 1].attendance_rate) - Number(row.attendance_rate) >= 15) {
      anomalies.push({
        weekStart: row.week_start,
        reason: 'Sharp attendance drop versus previous week',
      });
    }
  });

  return {
    attendanceConsistencyScore: Number(attendanceConsistencyScore.toFixed(2)),
    assignmentDelayTrend,
    assignmentDelaySlope: Number(delaySlope.toFixed(2)),
    deadlineMissFrequency: Number(deadlineMissFrequency.toFixed(2)),
    performanceStabilityIndex: Number(performanceStabilityIndex.toFixed(2)),
    attendanceDropPct: Number(attendanceDropPct.toFixed(2)),
    performanceDropPct: Number(performanceDropPct.toFixed(2)),
    riskScore: Number(riskScore.toFixed(2)),
    anomalies,
  };
}

function classifyRisk(indicators) {
  let level = 'Low';

  if (
    indicators.riskScore >= 65 ||
    indicators.attendanceDropPct >= 25 ||
    (indicators.assignmentDelayTrend === 'increasing' && indicators.deadlineMissFrequency >= 1.5)
  ) {
    level = 'High';
  } else if (
    indicators.riskScore >= 40 ||
    indicators.attendanceDropPct >= 12 ||
    indicators.performanceStabilityIndex < 75
  ) {
    level = 'Medium';
  }

  const factors = [];
  if (indicators.attendanceDropPct >= 10) factors.push(`${indicators.attendanceDropPct}% drop in attendance over tracked period`);
  if (indicators.assignmentDelayTrend === 'increasing') factors.push('assignment delay trend is increasing');
  if (indicators.deadlineMissFrequency >= 1) factors.push(`average ${indicators.deadlineMissFrequency} missed deadlines per week`);
  if (indicators.performanceStabilityIndex < 80) factors.push('performance scores are unstable');
  if (!factors.length) factors.push('attendance, deadlines, and performance remain stable');

  const explanation = `${level} risk due to ${factors.join(', ')}.`;

  return {
    level,
    explanation,
    contributingFactors: factors,
  };
}

module.exports = {
  computeIndicators,
  classifyRisk,
};
