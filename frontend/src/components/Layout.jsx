import { Link, useLocation } from 'react-router-dom';

const linkClass = (active) =>
  `px-3 py-2 rounded ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg">Academic Burnout Early Warning System</h1>
          <nav className="flex gap-2 text-sm">
            <Link to="/" className={linkClass(location.pathname === '/')}>Mentor Dashboard</Link>
            <Link to="/admin" className={linkClass(location.pathname === '/admin')}>Admin Panel</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
