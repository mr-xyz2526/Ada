const dataService = require('../services/dataService');
const { computeIndicators, classifyRisk } = require('../services/analyticsService');

async function enrichWithRisk(students) {
  const results = await Promise.all(
    students.map(async (student) => {
      const behavior = await dataService.getWeeklyBehavior(student.id);
      const indicators = computeIndicators(behavior);
      const risk = classifyRisk(indicators);
      return {
        ...student,
        currentRiskLevel: risk.level,
        riskScore: indicators.riskScore,
        lastActivity: behavior.at(-1)?.week_start || null,
      };
    }),
  );

  return results;
}

const studentController = {
  getStudents: async (req, res) => {
    const students = await dataService.getStudents({
      mentorId: req.user.id,
      role: req.user.role,
    });
    const enriched = await enrichWithRisk(students);

    const riskLevel = req.query.risk;
    const filtered = riskLevel ? enriched.filter((s) => s.currentRiskLevel === riskLevel) : enriched;

    res.json(filtered);
  },

  getStudentById: async (req, res) => {
    const student = await dataService.getStudentById(req.params.id, {
      role: req.user.role,
      mentorId: req.user.id,
    });

    if (!student) return res.status(404).json({ message: 'Student not found or unauthorized.' });
    return res.json(student);
  },

  getAnalytics: async (req, res) => {
    const student = await dataService.getStudentById(req.params.id, {
      role: req.user.role,
      mentorId: req.user.id,
    });
    if (!student) return res.status(404).json({ message: 'Student not found or unauthorized.' });

    const weeklyData = await dataService.getWeeklyBehavior(req.params.id);
    const indicators = computeIndicators(weeklyData);
    const risk = classifyRisk(indicators);
    const interventions = await dataService.getInterventions(req.params.id);

    return res.json({
      student,
      weeklyData,
      indicators,
      risk,
      interventions,
      trendSummary: {
        attendance: indicators.attendanceDropPct >= 10 ? 'Declining' : 'Stable',
        delays: indicators.assignmentDelayTrend,
        performance: indicators.performanceStabilityIndex < 75 ? 'Unstable' : 'Stable',
      },
    });
  },

  getRisk: async (req, res) => {
    const student = await dataService.getStudentById(req.params.id, {
      role: req.user.role,
      mentorId: req.user.id,
    });
    if (!student) return res.status(404).json({ message: 'Student not found or unauthorized.' });

    const weeklyData = await dataService.getWeeklyBehavior(req.params.id);
    const indicators = computeIndicators(weeklyData);
    const risk = classifyRisk(indicators);

    return res.json({ studentId: student.id, indicators, ...risk });
  },
};

module.exports = studentController;
