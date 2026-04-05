import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { withHeaders } from '../services/api';
import TrendChart from '../components/TrendChart';
import RiskBadge from '../components/RiskBadge';

export default function StudentDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [note, setNote] = useState('');

  async function load() {
    const res = await api.get(`/students/${id}/analytics`, withHeaders('mentor', 1));
    setData(res.data);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addNote() {
    if (!note.trim()) return;
    await api.post('/intervention', { studentId: Number(id), note }, withHeaders('mentor', 1));
    setNote('');
    load();
  }

  if (!data) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4 flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-lg">{data.student.name}</h2>
          <p className="text-sm text-slate-600">{data.student.program} • Year {data.student.year}</p>
        </div>
        <RiskBadge level={data.risk.level} />
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Explainability Panel</h3>
        <p className="text-sm text-slate-700 mb-2">{data.risk.explanation}</p>
        <ul className="list-disc ml-6 text-sm">
          {data.risk.contributingFactors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
        <div className="mt-3 text-sm text-slate-600">
          <p>Attendance consistency score: {data.indicators.attendanceConsistencyScore}</p>
          <p>Delay trend: {data.indicators.assignmentDelayTrend}</p>
          <p>Deadline miss frequency: {data.indicators.deadlineMissFrequency}/week</p>
          <p>Performance stability index: {data.indicators.performanceStabilityIndex}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TrendChart data={data.weeklyData} dataKey="attendance_rate" color="#2563eb" title="Attendance Trend" />
        <TrendChart data={data.weeklyData} dataKey="assignment_delay_hours" color="#ea580c" title="Assignment Delay Trend" />
        <TrendChart data={data.weeklyData} dataKey="performance_score" color="#16a34a" title="Performance Trend" />
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Behavior Change Timeline</h3>
          <ul className="space-y-2 text-sm max-h-64 overflow-auto">
            {data.weeklyData.map((w) => (
              <li key={w.week_start} className="border-l-2 border-slate-200 pl-3">
                <p className="font-medium">{w.week_start}</p>
                <p>Attendance: {w.attendance_rate}% | Delay: {w.assignment_delay_hours}h</p>
                <p>Missed deadlines: {w.deadlines_missed} | Performance: {w.performance_score}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Intervention Notes</h3>
        <div className="flex gap-2 mb-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add mentor intervention note"
            className="border rounded px-3 py-2 flex-1"
          />
          <button onClick={addNote} className="bg-blue-600 text-white px-3 rounded">Add</button>
        </div>
        <ul className="space-y-2 text-sm">
          {data.interventions.map((item) => (
            <li key={item.id} className="bg-slate-50 p-2 rounded border">
              <p>{item.note}</p>
              <p className="text-xs text-slate-500">{item.created_at} • {item.created_by_role}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
