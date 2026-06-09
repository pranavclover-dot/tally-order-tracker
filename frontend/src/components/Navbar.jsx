import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package } from 'lucide-react';
import NotificationBell from './NotificationBell';
import ReminderConfig from './ReminderConfig';

const NAV_LINKS = [
  { path: '/', label: 'Dashboard' },
  { path: '/orders', label: 'Orders' },
  { path: '/salesmen', label: 'Salesmen' },
  { path: '/notifications', label: 'Notifications' },
];

export default function Navbar() {
  const location = useLocation();
  const [showConfig, setShowConfig] = useState(false);

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 font-bold text-blue-700 text-lg">
                <Package className="w-5 h-5" />
                Order Tracker
              </Link>
              <div className="hidden sm:flex gap-1">
                {NAV_LINKS.map(({ path, label }) => {
                  const active = location.pathname === path;
                  return (
                    <Link key={path} to={path}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >{label}</Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowConfig(true)}
                className="hidden sm:block px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                ⚙ Settings
              </button>
              <NotificationBell />
            </div>
          </div>
        </div>
      </nav>
      {showConfig && <ReminderConfig onClose={() => setShowConfig(false)} />}
    </>
  );
}
