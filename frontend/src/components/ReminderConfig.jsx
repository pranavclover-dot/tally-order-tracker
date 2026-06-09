import { useState, useEffect } from 'react';
import { X, Save, CheckCircle } from 'lucide-react';
import api from '../api/client';

export default function ReminderConfig({ onClose }) {
  const [config, setConfig] = useState({ days_before: '7,3,1', email_enabled: true, inapp_enabled: true });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/config/reminders')
      .then((res) => {
        setConfig({
          days_before: res.data.days_before,
          email_enabled: Boolean(res.data.email_enabled),
          inapp_enabled: Boolean(res.data.inapp_enabled),
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await api.put('/config/reminders', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Reminder Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Days Before */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send reminders at (days before deadline)
              </label>
              <input
                type="text"
                value={config.days_before}
                onChange={(e) => setConfig({ ...config, days_before: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 7,3,1"
              />
              <p className="mt-1 text-xs text-gray-400">
                Comma-separated values. Example: <code className="bg-gray-100 px-1 rounded">7,3,1</code> sends reminders at 7 days, 3 days, and 1 day before the deadline.
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <Toggle
                label="Email Notifications"
                description="Send reminder emails via Gmail SMTP"
                checked={config.email_enabled}
                onChange={(v) => setConfig({ ...config, email_enabled: v })}
              />
              <Toggle
                label="In-App Notifications"
                description="Show alerts in the notification bell"
                checked={config.inapp_enabled}
                onChange={(v) => setConfig({ ...config, inapp_enabled: v })}
              />
            </div>

            {/* Gmail help */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">Gmail setup required for email notifications:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                <li>Enable 2-Factor Authentication on your Google account</li>
                <li>Go to Google Account → Security → App Passwords</li>
                <li>Generate a password for "Mail"</li>
                <li>Set <code className="bg-blue-100 px-1 rounded">GMAIL_USER</code> and <code className="bg-blue-100 px-1 rounded">GMAIL_PASS</code> in <code className="bg-blue-100 px-1 rounded">backend/.env</code></li>
              </ol>
            </div>

            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}
