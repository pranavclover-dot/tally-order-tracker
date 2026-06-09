import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api/client';

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setCount(res.data.count);
    } catch {
      // silently fail — backend may not be running yet
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      to="/notifications"
      className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      title="Notifications"
    >
      <Bell className={`w-5 h-5 ${count > 0 ? 'text-red-500' : 'text-gray-500'}`} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
