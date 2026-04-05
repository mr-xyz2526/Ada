import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { withHeaders } from '../services/api';
import RiskBadge from '../components/RiskBadge';

export default function MentorDashboard() {
  const [students, setStudents] = useState([]);
  const [riskFilter, setRiskFilter] = useState('All');
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await api.get('/mentor/dashboard', withHeaders('mentor', 1));
      setStudents(data.students);
      setAlerts(data.alerts);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (riskFilter === 'All') return students;
    return students.filter((s) => s.riskLevel === riskFilter);
  }, [students, riskFilter]);

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <h2 className="font-semibold text-rose-700">Active Alerts</h2>
          <ul className="list-disc ml-5 text-sm text-rose-700">
            {alerts.map((alert) => (
              <li key={alert.studentId}>{alert.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Assigned Students</h2>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option>All</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Name</th>
                <th>Risk</th>
                <th>Last Activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="border-b hover:bg-slate-50">
                  <td className="py-2">{student.name}</td>
                  <td><RiskBadge level={student.riskLevel} /></td>
                  <td>{student.lastActivity}</td>
                  <td>
                    <Link className="text-blue-600 hover:underline" to={`/students/${student.id}`}>
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
