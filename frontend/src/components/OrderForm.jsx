import { useState, useRef } from 'react';
import { X, Save, Camera, Edit3, Loader2, AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import api from '../api/client';

function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 12);
  return d.toISOString().split('T')[0];
}

const EMPTY = {
  order_number: '', customer_name: '', salesman_name: '', salesman_email: '',
  order_date: new Date().toISOString().split('T')[0],
  delivery_deadline: defaultDeadline(),
  amount: '', status: 'pending',
};

// Convert YYYY-MM-DD → input value (already correct format for <input type="date">)
// Convert display DD/MM/YYYY → YYYY-MM-DD for saving
function toInputDate(str) {
  if (!str) return '';
  if (str.includes('-') && str.length === 10) return str; // already YYYY-MM-DD
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';
  }
  return str;
}

export default function OrderForm({ order, onClose, onSaved }) {
  const [tab, setTab] = useState(order ? 'manual' : 'scan');
  const [form, setForm] = useState(order ? {
    order_number: order.order_number || '',
    customer_name: order.customer_name || '',
    salesman_name: order.salesman_name || '',
    salesman_email: order.salesman_email || '',
    order_date: order.order_date || EMPTY.order_date,
    delivery_deadline: order.delivery_deadline || '',
    amount: order.amount?.toString() || '',
    status: order.status || 'pending',
  } : { ...EMPTY });

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extracted, setExtracted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setExtracted(false);
    setExtractError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setExtracted(false);
      setExtractError('');
    }
  };

  const handleExtract = async () => {
    if (!image) return;
    setExtracting(true);
    setExtractError('');
    setExtracted(false);
    try {
      const fd = new FormData();
      fd.append('image', image);
      const res = await api.post('/orders/extract', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = res.data;
      setForm((prev) => ({
        ...prev,
        order_number:       d.order_number       || prev.order_number,
        customer_name:      d.customer_name      || prev.customer_name,
        salesman_name:      d.salesman_name      || prev.salesman_name,
        order_date:         toInputDate(d.order_date)         || prev.order_date,
        delivery_deadline:  toInputDate(d.delivery_deadline)  || prev.delivery_deadline,
        amount:             d.amount != null ? String(d.amount) : prev.amount,
      }));
      setExtracted(true);
      setTab('manual'); // switch to form tab to review
    } catch (err) {
      setExtractError(err.response?.data?.error || 'Could not read the image. Please try a clearer photo.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.customer_name.trim()) { setError('Customer name is required'); return; }
    if (!form.delivery_deadline) { setError('Delivery deadline is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (order?.id) {
        await api.put(`/orders/${order.id}`, form);
      } else {
        await api.post('/orders', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => ({
    value: form[field],
    onChange: (e) => setForm({ ...form, [field]: e.target.value }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {order ? 'Edit Order' : 'Add Order'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs — only shown for new orders */}
        {!order && (
          <div className="flex border-b flex-shrink-0">
            <TabBtn active={tab === 'scan'} onClick={() => setTab('scan')} icon={<Camera className="w-4 h-4" />} label="Scan Photo" />
            <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')} icon={<Edit3 className="w-4 h-4" />} label="Manual Entry" />
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {/* ── SCAN TAB ──────────────────────────────────── */}
          {tab === 'scan' && !order && (
            <div className="p-5 space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  imagePreview ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Order preview" className="max-h-52 mx-auto rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">Click or drag & drop a photo</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, HEIC up to 10MB</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              {imagePreview && (
                <button onClick={() => fileRef.current?.click()} className="text-xs text-blue-600 hover:underline w-full text-center">
                  Choose different photo
                </button>
              )}

              {extractError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {extractError}
                </div>
              )}

              {extracted && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Details extracted! Review them in the form.
                </div>
              )}

              <button
                onClick={handleExtract}
                disabled={!image || extracting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {extracting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Reading order...</>
                ) : (
                  <><Camera className="w-4 h-4" /> Extract Order Details</>
                )}
              </button>

              <p className="text-xs text-center text-gray-400">
                AI reads the photo and fills in all fields automatically
              </p>
            </div>
          )}

          {/* ── MANUAL / REVIEW FORM TAB ──────────────────── */}
          {(tab === 'manual' || order) && (
            <div className="p-5 space-y-4">
              {extracted && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  Fields filled from photo — please review before saving
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Order Number" className="col-span-1">
                  <input type="text" placeholder="ORD-001" className={INPUT} {...f('order_number')} />
                </Field>
                <Field label="Status" className="col-span-1">
                  <select className={INPUT} {...f('status')}>
                    <option value="pending">Pending</option>
                    <option value="shipped">Shipped</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
              </div>

              <Field label="Customer Name *">
                <input type="text" placeholder="e.g. Tata Steel Industries" className={INPUT} {...f('customer_name')} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Salesman Name">
                  <input type="text" placeholder="e.g. Raj Sharma" className={INPUT} {...f('salesman_name')} />
                </Field>
                <Field label="Salesman Email">
                  <input type="email" placeholder="raj@company.com" className={INPUT} {...f('salesman_email')} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Order Date">
                  <input type="date" className={INPUT} {...f('order_date')} />
                </Field>
                <Field label="Delivery Deadline *">
                  <input type="date" className={INPUT} {...f('delivery_deadline')} />
                </Field>
              </div>

              <Field label="Amount (₹)">
                <input type="number" placeholder="e.g. 125000" className={INPUT} {...f('amount')} />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        {(tab === 'manual' || order) && (
          <div className="p-5 border-t flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> {order ? 'Save Changes' : 'Add Order'}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}{label}
    </button>
  );
}
