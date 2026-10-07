import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Salesmen from './pages/Salesmen';
import Notifications from './pages/Notifications';
import SalesmanLogin from './pages/SalesmanLogin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Salesman login — no navbar */}
        <Route path="/salesman-login" element={
          <div className="min-h-screen bg-gray-50">
            <SalesmanLogin />
          </div>
        } />

        {/* Main app */}
        <Route path="*" element={
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
        } />
      </Routes>
    </BrowserRouter>
  );
}
