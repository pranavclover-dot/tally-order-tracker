import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, User, Mail, Phone, Package, Save, RefreshCw, Zap } from 'lucide-react';
import api from '../api/client';

const EMPTY_FORM = { name: '', email: '', phone: '' };

export default function Salesmen() {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchSalesmen = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/salesmen');
      setSalesmen(res.data);
    } catch (err) {
      console.error('Failed to fetch salesmen:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSalesmen(); }, [fetchSalesmen]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setForm({ name: s.name, email: s.email, phone: s.phone || '' });
    setEditId(s.id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.put(`/salesmen/${editId}`, form);
      } else {
        await api.post('/salesmen', form);
      }
      setShowForm(false);
      fetchSalesmen();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete salesman "${name}"? This will not affect existing orders.`)) return;
    await api.delete(`/salesmen/${id}`);
    fetchSalesmen();
  };

  const handleBackfill = async () => {
    const res = await api.post('/salesmen/backfill-emails');
    alert(`Done — ${res.data.updated} order${res.data.updated !== 1 ? 's' : ''} updated with missing emails.`);
    fetchSalesmen();
  };

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salesmen</h1>
            <p className="text-sm text-gray-500 mt-1">{salesmen.length} registered salesman{salesmen.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackfill}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors"
              title="Fill missing emails in existing orders from this list"
            >
              <Zap className="w-4 h-4" />
              Fix Missing Emails
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Salesman
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : salesmen.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No salesmen added yet</p>
            <p className="text-sm text-gray-400 mt-1">Add salesmen to link them with email notifications</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesmen.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Package className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs text-blue-600 font-medium">
                          {s.activeOrders} active order{s.activeOrders !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </div>
                  {s.phone && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{s.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editId ? 'Edit Salesman' : 'Add Salesman'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <FormField label="Full Name *" icon={<User className="w-4 h-4" />}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Raj Sharma"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Email Address *" icon={<Mail className="w-4 h-4" />}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. raj.sharma@company.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Phone (optional)" icon={<Phone className="w-4 h-4" />}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : (editId ? 'Save Changes' : 'Add Salesman')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FormField({ label, icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        <span className="text-gray-400">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}
