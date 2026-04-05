import { useEffect, useState } from 'react';
import api, { withHeaders } from '../services/api';

export default function AdminPanel() {
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);

  async function load() {
    const [studentsRes, mentorsRes] = await Promise.all([
      api.get('/students', withHeaders('admin', 99)),
      api.get('/admin/mentors', withHeaders('admin', 99)),
    ]);
    setStudents(studentsRes.data);
    setMentors(mentorsRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function assign(studentId, mentorId) {
    await api.post('/admin/assign-mentor', { studentId, mentorId: Number(mentorId) }, withHeaders('admin', 99));
    load();
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <h2 className="font-semibold mb-3">Assign Students to Mentors</h2>
      <div className="space-y-3">
        {students.slice(0, 30).map((student) => (
          <div key={student.id} className="flex justify-between items-center border rounded p-2">
            <div>
              <p className="font-medium">{student.name}</p>
              <p className="text-xs text-slate-500">Current mentor: {student.mentor_name || 'None'}</p>
            </div>
            <select
              onChange={(e) => assign(student.id, e.target.value)}
              defaultValue={student.mentor_id || ''}
              className="border rounded px-2 py-1"
            >
              <option value="" disabled>Assign mentor</option>
              {mentors.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>{mentor.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
