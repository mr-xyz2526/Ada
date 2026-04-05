import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import MentorDashboard from './pages/MentorDashboard';
import StudentDetail from './pages/StudentDetail';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MentorDashboard />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
