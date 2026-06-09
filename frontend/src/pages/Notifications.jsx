import { useState, useEffect, useCallback } from 'react';
import { BellOff, Mail, Smartphone, MessageSquare, CheckCheck, RefreshCw } from 'lucide-react';
import api from '../api/client';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff/60000), hours = Math.floor(mins/60), days = Math.floor(hours/24);
  if (days>0) return `${days}d ago`;
  if (hours>0) return `${hours}h ago`;
  if (mins>0) return `${mins}m ago`;
  return 'just now';
}

const TYPE_CONFIG = {
  email:      { bg:'bg-blue-50',   text:'text-blue-600',   icon:<Mail className="w-3.5 h-3.5"/>,        label:'Email' },
  'in-app':   { bg:'bg-purple-50', text:'text-purple-600', icon:<Smartphone className="w-3.5 h-3.5"/>,  label:'In-App' },
  'follow-up':{ bg:'bg-amber-50',  text:'text-amber-600',  icon:<MessageSquare className="w-3.5 h-3.5"/>, label:'Follow-up' },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { filter } });
      setNotifications(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id===id ? {...n,is_read:1} : n));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({...n,is_read:1})));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">{unreadCount>0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        {unreadCount>0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
            <CheckCheck className="w-4 h-4"/> Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {['all','unread','read'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter===f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Type legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(TYPE_CONFIG).map(([key,cfg]) => (
          <span key={key} className={`flex items-center gap-1 px-2 py-1 rounded-full ${cfg.bg} ${cfg.text} font-medium`}>
            {cfg.icon}{cfg.label}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2"/>Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <BellOff className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
            <p className="text-gray-500 font-medium">{filter==='unread' ? 'No unread notifications' : 'No notifications yet'}</p>
          </div>
        ) : (
          notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG['in-app'];
            return (
              <div key={n.id} className={`bg-white rounded-xl border transition-colors ${n.is_read ? 'border-gray-100' : 'border-blue-200 shadow-sm'}`}>
                <div className="p-4 flex gap-4">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center ${cfg.text}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-gray-900">{n.salesman_name}</span>
                          {n.order_number && <span className="text-xs text-blue-600 font-medium">{n.order_number}</span>}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            {cfg.icon}{cfg.label}
                          </span>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"/>}
                        </div>
                        <p className="text-sm text-gray-600 leading-snug">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1.5">{timeAgo(n.sent_at)}</p>
                      </div>
                      {!n.is_read && (
                        <button onClick={() => markRead(n.id)}
                          className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 px-2 py-1 rounded-md transition-colors">
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
