import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, BellRing, BellOff, Menu, X, LogOut } from 'lucide-react';
import NotificationBell from './NotificationBell';
import ReminderConfig from './ReminderConfig';
import api from '../api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const NAV_LINKS = [
  { path: '/', label: 'Dashboard' },
  { path: '/orders', label: 'Orders' },
  { path: '/salesmen', label: 'Salesmen' },
  { path: '/notifications', label: 'Notifications' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showConfig, setShowConfig] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState('unknown');
  const [salesmanName, setSalesmanName] = useState(() => localStorage.getItem('salesmanName') || null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setPushStatus('denied'); return; }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setPushStatus(sub ? 'subscribed' : 'unsubscribed'))
    ).catch(() => setPushStatus('unsubscribed'));
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handlePushToggle = async () => {
    if (pushStatus === 'unsupported' || pushStatus === 'denied') return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      if (pushStatus === 'subscribed') {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api.post('/push/unsubscribe', { subscription: sub.toJSON() });
          await sub.unsubscribe();
        }
        setPushStatus('unsubscribed');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushStatus('denied'); return; }

      const { data } = await api.get('/push/vapid-key');
      if (!data.publicKey) return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
      await api.post('/push/subscribe', { subscription: sub.toJSON(), salesmanName: salesmanName || undefined });
      setPushStatus('subscribed');
    } catch (err) {
      console.error('[Push]', err);
    }
  };

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-bold text-blue-700 text-lg">
              <Package className="w-5 h-5" />
              Order Tracker
            </Link>

            {/* Desktop nav links */}
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

            {/* Right side */}
            <div className="flex items-center gap-2">
              {salesmanName && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                  <span className="text-xs font-semibold text-blue-700">{salesmanName}</span>
                  <button
                    onClick={() => { localStorage.removeItem('salesmanName'); localStorage.removeItem('pushEnabled'); setSalesmanName(null); navigate('/salesman-login'); }}
                    title="Switch user"
                    className="text-blue-400 hover:text-blue-700 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <button onClick={() => setShowConfig(true)}
                className="hidden sm:block px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                ⚙ Settings
              </button>
              {pushStatus !== 'unsupported' && (
                <button
                  onClick={handlePushToggle}
                  title={pushStatus === 'subscribed' ? 'Push ON — tap to disable' : pushStatus === 'denied' ? 'Notifications blocked' : 'Enable push notifications'}
                  className={`p-2 rounded-full transition-all ${
                    pushStatus === 'subscribed'
                      ? 'text-white bg-green-500 hover:bg-green-600 shadow-sm'
                      : pushStatus === 'denied'
                      ? 'text-gray-300 bg-gray-100 cursor-not-allowed'
                      : 'text-gray-400 bg-gray-100 hover:bg-red-50 hover:text-red-400'
                  }`}
                >
                  {pushStatus === 'subscribed' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              )}
              <NotificationBell />

              {/* Hamburger — mobile only */}
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="sm:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Menu"
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white shadow-lg">
            <div className="px-4 py-2 space-y-1">
              {NAV_LINKS.map(({ path, label }) => {
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >{label}</Link>
                );
              })}
              <button
                onClick={() => { setShowConfig(true); setMenuOpen(false); }}
                className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ⚙ Settings
              </button>
              {salesmanName && (
                <div className="px-4 py-3 border-t border-gray-100 mt-1">
                  <p className="text-xs text-gray-400 mb-1">Logged in as</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-700">{salesmanName}</span>
                    <button
                      onClick={() => { localStorage.removeItem('salesmanName'); localStorage.removeItem('pushEnabled'); setSalesmanName(null); setMenuOpen(false); navigate('/salesman-login'); }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Switch User
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {showConfig && <ReminderConfig onClose={() => setShowConfig(false)} />}
    </>
  );
}
