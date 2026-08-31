import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Truck, Package, Loader2, Upload, CheckCircle2, RotateCcw, Eye } from 'lucide-react';
import api from '../api/client';

const formatDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const EMPTY_ITEM = { product_name: '', quantity: '1', amount: '', delivery_deadline: '' };

function DispatchModal({ item, orderId, onDone, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleConfirm = async () => {
    setUploading(true);
    try {
      const fd = new FormData();
      if (file) fd.append('proof', file);
      const res = await api.patch(`/orders/${orderId}/items/${item.id}/dispatch`, fd, {
        headers: file ? { 'Content-Type': 'multipart/form-data' } : {},
      });
      onDone(res.data);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Mark as Dispatched</h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-[220px]">{item.product_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">Upload a photo of the transport document or packed order as proof.</p>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              preview ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
            }`}
            onClick={() => fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            onDragOver={e => e.preventDefault()}
          >
            {preview ? (
              <img src={preview} alt="Proof" className="max-h-40 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Click or drag photo here</p>
                <p className="text-xs text-gray-400 mt-1">Transport challan, LR copy, packed box photo</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>

          {preview && (
            <button onClick={() => { setFile(null); setPreview(null); }}
              className="text-xs text-blue-600 hover:underline w-full text-center">
              Choose different photo
            </button>
          )}

          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              {uploading ? 'Saving...' : 'Confirm Dispatch'}
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">Photo is optional — you can confirm dispatch without it</p>
        </div>
      </div>
    </div>
  );
}

export default function SplitBillModal({ order, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [dispatching, setDispatching] = useState(null); // item being dispatched
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
      const res = await api.post(`/orders/${order.id}/items`, {
        product_name: newItem.product_name.trim(),
        quantity: parseFloat(newItem.quantity) || 1,
        amount: parseFloat(newItem.amount) || 0,
        delivery_deadline: newItem.delivery_deadline || null,
      });
      setItems(prev => [...prev, res.data]);
      setNewItem({ ...EMPTY_ITEM });
      setAdding(false);
    } catch (e) { setError(e.response?.data?.error || 'Failed to add item'); }
    finally { setSaving(false); }
  };

  const handleDispatchDone = (updatedItem) => {
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const handleRevert = async (itemId) => {
    try {
      const res = await api.patch(`/orders/${order.id}/items/${itemId}/revert`);
      setItems(prev => prev.map(i => i.id === itemId ? res.data : i));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (itemId) => {
    try {
      await api.delete(`/orders/${order.id}/items/${itemId}`);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (e) { console.error(e); }
  };

  const viewProof = (itemId) => {
    window.open(`${api.defaults.baseURL}/orders/${order.id}/items/${itemId}/proof`, '_blank');
  };

  const dispatchedCount = items.filter(i => i.status === 'dispatched').length;

  return (
    <>
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
            <div className="px-5 py-2.5 bg-gray-50 border-b flex items-center gap-4 text-sm flex-shrink-0">
              <span className="text-gray-500">{items.length} product{items.length !== 1 ? 's' : ''}</span>
              <span className="text-green-700 font-medium">{dispatchedCount} dispatched</span>
              <span className="text-blue-700 font-medium">{items.filter(i => i.status === 'pending').length} pending</span>
            </div>
          )}

          {/* Items */}
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading...
              </div>
            ) : items.length === 0 && !adding ? (
              <div className="py-10 text-center text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">No products added yet</p>
                <p className="text-sm mt-1">Add each product with its own delivery date</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className={`border rounded-xl p-4 transition-colors ${
                  item.status === 'dispatched' ? 'border-green-200 bg-green-50/40' : 'border-gray-100 bg-white shadow-sm'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.status === 'dispatched' && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                        <p className="font-semibold text-gray-900 truncate">{item.product_name}</p>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                        <span>Qty: {item.quantity}</span>
                        {item.amount > 0 && <span>₹{Number(item.amount).toLocaleString('en-IN')}</span>}
                        {item.delivery_deadline && <span>Due: {formatDate(item.delivery_deadline)}</span>}
                        {item.dispatched_at && (
                          <span className="text-green-600">Dispatched: {formatDate(item.dispatched_at?.split('T')[0])}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-400" />
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {item.status === 'pending' && (
                      <button onClick={() => setDispatching(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        <Truck className="w-3.5 h-3.5" /> Mark Dispatched
                      </button>
                    )}
                    {item.status === 'dispatched' && (
                      <>
                        {item.has_proof && (
                          <button onClick={() => viewProof(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                            <Eye className="w-3.5 h-3.5" /> View Proof
                          </button>
                        )}
                        <button onClick={() => handleRevert(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <RotateCcw className="w-3 h-3" /> Undo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Add form */}
            {adding && (
              <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
                <p className="text-sm font-semibold text-gray-700">New Product</p>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <input type="text" placeholder="Product name *"
                  value={newItem.product_name}
                  onChange={e => setNewItem({ ...newItem, product_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                    <input type="number" placeholder="1" value={newItem.quantity}
                      onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
                    <input type="number" placeholder="0" value={newItem.amount}
                      onChange={e => setNewItem({ ...newItem, amount: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Delivery Date</label>
                    <input type="date" value={newItem.delivery_deadline}
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

      {/* Dispatch proof upload modal */}
      {dispatching && (
        <DispatchModal
          item={dispatching}
          orderId={order.id}
          onDone={handleDispatchDone}
          onClose={() => setDispatching(null)}
        />
      )}
    </>
  );
}
