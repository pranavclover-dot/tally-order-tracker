import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Truck, CheckCircle2, Package, Loader2 } from 'lucide-react';
import api from '../api/client';

const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const STATUS_STYLE = {
  pending:   'bg-blue-50 text-blue-700',
  shipped:   'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
};

const EMPTY_ITEM = { product_name: '', quantity: '1', amount: '', delivery_deadline: '' };

export default function SplitBillModal({ order, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ ...EMPTY_ITEM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${order.id}/items`);
      setItems(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newItem.product_name.trim()) { setError('Product name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/orders/${order.id}/items`, {
        product_name: newItem.product_name.trim(),
        quantity: parseFloat(newItem.quantity) || 1,
        amount: parseFloat(newItem.amount) || 0,
        delivery_deadline: newItem.delivery_deadline || null,
      });
      setNewItem({ ...EMPTY_ITEM });
      setAdding(false);
      await fetchItems();
    } catch (e) { setError(e.response?.data?.error || 'Failed to add item'); }
    finally { setSaving(false); }
  };

  const handleStatus = async (itemId, status) => {
    try {
      await api.patch(`/orders/${order.id}/items/${itemId}/status`, { status });
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status } : i));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (itemId) => {
    try {
      await api.delete(`/orders/${order.id}/items/${itemId}`);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (e) { console.error(e); }
  };

  const shippedCount = items.filter(i => i.status === 'shipped' || i.status === 'completed').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Split Bill — {order.order_number}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{order.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Summary bar */}
        {items.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-4 text-sm flex-shrink-0">
            <span className="text-gray-500">{items.length} product{items.length !== 1 ? 's' : ''}</span>
            <span className="text-yellow-700 font-medium">{shippedCount} shipped</span>
            <span className="text-blue-700 font-medium">{items.filter(i => i.status === 'pending').length} pending</span>
          </div>
        )}

        {/* Items list */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading...
            </div>
          ) : items.length === 0 && !adding ? (
            <div className="py-10 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No products added yet</p>
              <p className="text-sm mt-1">Add products below to split this order</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.product_name}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                      <span>Qty: {item.quantity}</span>
                      {item.amount > 0 && <span>₹{Number(item.amount).toLocaleString('en-IN')}</span>}
                      {item.delivery_deadline && <span>Due: {formatDate(item.delivery_deadline)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[item.status]}`}>
                      {item.status}
                    </span>
                    <button onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  {item.status === 'pending' && (
                    <button onClick={() => handleStatus(item.id, 'shipped')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
                      <Truck className="w-3.5 h-3.5" /> Mark Shipped
                    </button>
                  )}
                  {item.status === 'shipped' && (
                    <button onClick={() => handleStatus(item.id, 'completed')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                    </button>
                  )}
                  {item.status !== 'pending' && (
                    <button onClick={() => handleStatus(item.id, 'pending')}
                      className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      Revert to Pending
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Add item form */}
          {adding && (
            <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
              <p className="text-sm font-semibold text-gray-700">New Product</p>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <input
                type="text" placeholder="Product name *"
                value={newItem.product_name}
                onChange={e => setNewItem({ ...newItem, product_name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                  <input type="number" placeholder="1"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
                  <input type="number" placeholder="0"
                    value={newItem.amount}
                    onChange={e => setNewItem({ ...newItem, amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Delivery Date</label>
                  <input type="date"
                    value={newItem.delivery_deadline}
                    onChange={e => setNewItem({ ...newItem, delivery_deadline: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Add Product'}
                </button>
                <button onClick={() => { setAdding(false); setError(''); setNewItem({ ...EMPTY_ITEM }); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex-shrink-0">
          {!adding && (
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium rounded-xl hover:border-blue-300 hover:text-blue-600 transition-colors">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
