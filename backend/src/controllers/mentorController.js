const dataService = require('../services/dataService');
const { computeIndicators, classifyRisk } = require('../services/analyticsService');

const mentorController = {
  getDashboard: async (req, res) => {
    const students = await dataService.getStudents({ role: req.user.role, mentorId: req.user.id });

    const riskBuckets = { Low: 0, Medium: 0, High: 0 };
    const alerts = [];

    const enrichedStudents = await Promise.all(
      students.map(async (student) => {
        const weeklyData = await dataService.getWeeklyBehavior(student.id);
        const indicators = computeIndicators(weeklyData);
        const risk = classifyRisk(indicators);
        riskBuckets[risk.level] += 1;

        if (risk.level === 'High') {
          alerts.push({
            studentId: student.id,
            studentName: student.name,
            message: `High risk student detected: ${student.name}`,
          });
        }

        return {
          ...student,
          riskLevel: risk.level,
          riskScore: indicators.riskScore,
          explanation: risk.explanation,
          lastActivity: weeklyData.at(-1)?.week_start || null,
        };
      }),
    );

    return res.json({
      mentorId: req.user.id,
      riskBuckets,
      alerts,
      students: enrichedStudents,
    });
  },
};

module.exports = mentorController;
