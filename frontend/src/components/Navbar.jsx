import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, BellRing, BellOff } from 'lucide-react';
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
  const [showConfig, setShowConfig] = useState(false);
  const [pushStatus, setPushStatus] = useState('unknown'); // 'unknown'|'subscribed'|'denied'|'unsupported'

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
      await api.post('/push/subscribe', { subscription: sub.toJSON() });
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
              {pushStatus !== 'unsupported' && (
                <button
                  onClick={handlePushToggle}
                  title={pushStatus === 'subscribed' ? 'Push notifications ON — click to disable' : pushStatus === 'denied' ? 'Notifications blocked in browser settings' : 'Enable push notifications'}
                  className={`p-2 rounded-full transition-colors ${pushStatus === 'subscribed' ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : pushStatus === 'denied' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                >
                  {pushStatus === 'subscribed' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              )}
              <NotificationBell />
            </div>
          </div>
        </div>
      </nav>
      {showConfig && <ReminderConfig onClose={() => setShowConfig(false)} />}
    </>
  );
}
