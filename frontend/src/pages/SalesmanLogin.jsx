import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import api from '../api/client';

export default function SalesmanLogin() {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/salesmen').then(({ data }) => {
      setSalesmen(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function handleSelect(name) {
    localStorage.setItem('salesmanName', name);
    navigate('/');
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
          <div className="bg-blue-100 p-4 rounded-full">
            <User className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Who are you?</h1>
        <p className="text-gray-500 mt-1 text-sm">Tap your name to get your notifications</p>
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
          <p className="text-center text-gray-400 py-8">No salesmen found. Add them in the Salesmen page.</p>
        )}
      </div>
    </div>
  );
}
