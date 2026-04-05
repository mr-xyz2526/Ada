const db = require('../config/db');

/**
 * Abstraction layer for future ERP/LMS integration.
 * Current implementation uses PostgreSQL, but this service can be swapped for external connectors.
 */
const dataService = {
  getStudents: async ({ mentorId, riskLevel, role }) => {
    const values = [];
    const where = [];

    if (role === 'mentor') {
      values.push(mentorId);
      where.push(`s.mentor_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const studentsRes = await db.query(
      `SELECT s.id, s.name, s.email, s.program, s.year, s.mentor_id, m.name AS mentor_name
       FROM students s
       LEFT JOIN mentors m ON m.id = s.mentor_id
       ${whereClause}
       ORDER BY s.id`,
      values,
    );

    if (!riskLevel) return studentsRes.rows;

    return studentsRes.rows.filter((student) => student.currentRiskLevel === riskLevel);
  },

  getStudentById: async (id, { role, mentorId }) => {
    const res = await db.query(
      `SELECT s.id, s.name, s.email, s.program, s.year, s.mentor_id, m.name AS mentor_name
       FROM students s
       LEFT JOIN mentors m ON m.id = s.mentor_id
       WHERE s.id = $1`,
      [id],
    );

    if (!res.rows.length) return null;

    const student = res.rows[0];
    if (role === 'mentor' && Number(student.mentor_id) !== Number(mentorId)) return null;
    return student;
  },

  getWeeklyBehavior: async (studentId) => {
    const res = await db.query(
      `SELECT week_start, attendance_rate, assignment_delay_hours, deadlines_missed, performance_score, assignments_submitted
       FROM weekly_behavior
       WHERE student_id = $1
       ORDER BY week_start`,
      [studentId],
    );
    return res.rows;
  },

  getInterventions: async (studentId) => {
    const res = await db.query(
      `SELECT i.id, i.note, i.created_at, i.created_by_role, i.mentor_id, m.name AS mentor_name
       FROM interventions i
       LEFT JOIN mentors m ON m.id = i.mentor_id
       WHERE i.student_id = $1
       ORDER BY i.created_at DESC`,
      [studentId],
    );
    return res.rows;
  },

  createIntervention: async ({ studentId, mentorId, note, role }) => {
    const res = await db.query(
      `INSERT INTO interventions (student_id, mentor_id, note, created_by_role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [studentId, mentorId || null, note, role],
    );
    return res.rows[0];
  },

  getMentors: async () => {
    const res = await db.query('SELECT id, name, email FROM mentors ORDER BY id');
    return res.rows;
  },

  assignMentor: async ({ studentId, mentorId }) => {
    const res = await db.query(
      'UPDATE students SET mentor_id = $1 WHERE id = $2 RETURNING id, name, mentor_id',
      [mentorId, studentId],
    );
    return res.rows[0] || null;
  },
};

module.exports = dataService;
