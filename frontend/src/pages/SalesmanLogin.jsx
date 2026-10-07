import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, CheckCircle, Loader } from 'lucide-react';
import api from '../api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function SalesmanLogin() {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('pick'); // 'pick' | 'push'
  const [selectedName, setSelectedName] = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/salesmen').then(({ data }) => {
      setSalesmen(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function handleSelect(name) {
    setSelectedName(name);
    setStep('push');
  }

  async function handleEnablePush() {
    setPushLoading(true);
    setPushError('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications not supported on this device');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Please allow notifications when the browser asks');
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { data } = await api.get('/push/vapid-key');
      if (!data.publicKey) throw new Error('Server not configured for push');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
      await api.post('/push/subscribe', { subscription: sub.toJSON(), salesmanName: selectedName });
      localStorage.setItem('salesmanName', selectedName);
      localStorage.setItem('pushEnabled', '1');
      navigate('/');
    } catch (err) {
      setPushError(err.message || 'Something went wrong');
      setPushLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (step === 'push') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-green-100 p-4 rounded-full">
            <Bell className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Enable Notifications</h2>
        <p className="text-gray-500 text-sm mb-2">
          Hi <span className="font-semibold text-blue-600">{selectedName}</span>!
        </p>
        <p className="text-gray-500 text-sm mb-6">
          Allow notifications so you get alerts for your orders — deadlines, overdue, and day-of reminders.
        </p>

        {pushError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {pushError}
          </div>
        )}

        <button
          onClick={handleEnablePush}
          disabled={pushLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold rounded-xl transition-colors"
        >
          {pushLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
          {pushLoading ? 'Setting up...' : 'Allow Notifications'}
        </button>

        <button
          onClick={() => setStep('pick')}
          className="mt-3 w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-blue-100 p-4 rounded-full">
              <User className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Who are you?</h1>
          <p className="text-gray-500 mt-1 text-sm">Tap your name to continue</p>
        </div>

        <div className="space-y-3">
          {salesmen.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s.name)}
              className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md active:scale-95 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-900 font-medium text-lg">{s.name}</span>
            </button>
          ))}

          {salesmen.length === 0 && (
            <p className="text-center text-gray-400 py-8">No salesmen found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
