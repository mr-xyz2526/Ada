CREATE TABLE IF NOT EXISTS mentors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  program VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  mentor_id INTEGER REFERENCES mentors(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly_behavior (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  attendance_rate NUMERIC(5,2) NOT NULL,
  assignment_delay_hours NUMERIC(7,2) NOT NULL,
  deadlines_missed INTEGER NOT NULL,
  performance_score NUMERIC(5,2) NOT NULL,
  assignments_submitted INTEGER NOT NULL,
  UNIQUE(student_id, week_start)
);

CREATE TABLE IF NOT EXISTS interventions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mentor_id INTEGER REFERENCES mentors(id),
  note TEXT NOT NULL,
  created_by_role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_behavior_student ON weekly_behavior(student_id, week_start);
CREATE INDEX IF NOT EXISTS idx_students_mentor ON students(mentor_id);
