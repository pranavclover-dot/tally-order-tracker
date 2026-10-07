import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Salesmen from './pages/Salesmen';
import Notifications from './pages/Notifications';
import SalesmanLogin from './pages/SalesmanLogin';

function RequireSetup({ children }) {
  const name = localStorage.getItem('salesmanName');
  const push = localStorage.getItem('pushEnabled');
  if (!name || !push) return <Navigate to="/salesman-login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Salesman login — no navbar, always accessible */}
        <Route path="/salesman-login" element={<SalesmanLogin />} />

        {/* Main app — requires login + push */}
        <Route path="*" element={
          <RequireSetup>
            <div className="min-h-screen bg-gray-50">
              <Navbar />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/salesmen" element={<Salesmen />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </RequireSetup>
        } />
      </Routes>
    </BrowserRouter>
  );
}
