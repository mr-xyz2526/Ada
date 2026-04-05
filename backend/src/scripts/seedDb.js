const db = require('../config/db');

const firstNames = ['Alex', 'Jordan', 'Taylor', 'Riley', 'Sam', 'Casey', 'Morgan', 'Avery', 'Jamie', 'Quinn'];
const lastNames = ['Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Davis', 'Miller', 'Wilson', 'Moore', 'Anderson'];
const programs = ['Computer Science', 'Engineering', 'Business', 'Biology', 'Economics'];

const mentors = [
  { name: 'Dr. Sarah Bennett', email: 'sarah.bennett@college.edu' },
  { name: 'Prof. Daniel Kim', email: 'daniel.kim@college.edu' },
  { name: 'Dr. Olivia Patel', email: 'olivia.patel@college.edu' },
  { name: 'Prof. Marcus Reed', email: 'marcus.reed@college.edu' },
];

const random = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function studentName(i) {
  return `${pick(firstNames)} ${pick(lastNames)} ${i}`;
}

function profileFor(index) {
  if (index % 3 === 0) return 'stable';
  if (index % 3 === 1) return 'moderate_decline';
  return 'strong_decline';
}

function generateWeek(profile, weekIdx) {
  if (profile === 'stable') {
    return {
      attendance: random(85, 98) - weekIdx * random(0, 0.3),
      delay: random(2, 8) + weekIdx * random(0, 0.3),
      missed: Math.round(random(0, 1)),
      performance: random(75, 92) - weekIdx * random(0, 0.3),
    };
  }

  if (profile === 'moderate_decline') {
    return {
      attendance: random(80, 94) - weekIdx * random(1.2, 1.8),
      delay: random(6, 16) + weekIdx * random(1.0, 2.0),
      missed: Math.round(random(0, 2)),
      performance: random(70, 88) - weekIdx * random(0.8, 1.5),
    };
  }

  return {
    attendance: random(75, 90) - weekIdx * random(2.0, 3.2),
    delay: random(12, 24) + weekIdx * random(2.5, 4.5),
    missed: Math.round(random(1, 4)),
    performance: random(65, 85) - weekIdx * random(1.5, 2.8),
  };
}

async function run() {
  await db.query('TRUNCATE interventions, weekly_behavior, students, mentors RESTART IDENTITY CASCADE');

  for (const mentor of mentors) {
    await db.query('INSERT INTO mentors (name, email) VALUES ($1, $2)', [mentor.name, mentor.email]);
  }

  const mentorIds = (await db.query('SELECT id FROM mentors ORDER BY id')).rows.map((m) => m.id);

  const studentCount = 72;
  const weeks = 10;

  for (let i = 1; i <= studentCount; i += 1) {
    const name = studentName(i);
    const email = `student${i}@college.edu`;
    const program = pick(programs);
    const year = Math.ceil(random(1, 4));
    const mentorId = mentorIds[i % mentorIds.length];

    const studentRes = await db.query(
      'INSERT INTO students (name, email, program, year, mentor_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, email, program, year, mentorId],
    );

    const studentId = studentRes.rows[0].id;
    const profile = profileFor(i);

    for (let w = 0; w < weeks; w += 1) {
      const weekDate = new Date();
      weekDate.setDate(weekDate.getDate() - (weeks - 1 - w) * 7);

      const raw = generateWeek(profile, w);

      await db.query(
        `INSERT INTO weekly_behavior (
          student_id, week_start, attendance_rate, assignment_delay_hours, deadlines_missed, performance_score, assignments_submitted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          studentId,
          weekDate.toISOString().split('T')[0],
          Math.max(40, Math.min(100, raw.attendance)).toFixed(2),
          Math.max(0, raw.delay).toFixed(2),
          Math.max(0, Math.min(5, raw.missed)),
          Math.max(35, Math.min(100, raw.performance)).toFixed(2),
          Math.round(random(2, 6)),
        ],
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete with 72 students and 10 weeks each.');
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
