import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import api from '../api/client';
import DeadlineBadge from '../components/DeadlineBadge';
import OrderCard from '../components/OrderCard';
import OrderForm from '../components/OrderForm';

const formatDate = (d) => {
  if (!d) return 'N/A';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_TABS = ['all', 'pending', 'shipped', 'completed', 'cancelled'];
const STATUS_BADGE = {
  pending:   'bg-blue-50 text-blue-700 border border-blue-100',
  shipped:   'bg-yellow-50 text-yellow-700 border border-yellow-100',
  completed: 'bg-green-50 text-green-700 border border-green-100',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [salesman, setSalesman] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);   // OrderCard detail view
  const [editing, setEditing] = useState(null);      // OrderForm for edit (pass order)
  const [showAdd, setShowAdd] = useState(false);     // OrderForm for new order

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusTab !== 'all') params.status = statusTab;
      if (salesman) params.salesman = salesman;
      const res = await api.get('/orders', { params });
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [statusTab, salesman]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatusChange = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    setSelected(null);
    fetchOrders();
  };

  const handleDelete = async (id, orderNum) => {
    if (!confirm(`Delete order ${orderNum}? This cannot be undone.`)) return;
    await api.delete(`/orders/${id}`);
    fetchOrders();
  };

  const allSalesmen = [...new Set(orders.map((o) => o.salesman_name).filter(Boolean))].sort();

  const filtered = orders.filter(
    (o) =>
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.order_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-500 mt-1">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Order
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  statusTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <select
            value={salesman}
            onChange={(e) => setSalesman(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Salesmen</option>
            {allSalesmen.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Order #</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Salesman</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Order Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Deadline</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Days Left</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading...
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">No orders found</td></tr>
                ) : (
                  filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-blue-700 cursor-pointer" onClick={() => setSelected(order)}>
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-[150px] truncate cursor-pointer" onClick={() => setSelected(order)}>
                        {order.customer_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{order.salesman_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(order.order_date)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(order.delivery_deadline)}</td>
                      <td className="px-4 py-3"><DeadlineBadge daysLeft={order.daysLeft} status={order.status} /></td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{formatINR(order.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[order.status] || ''}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditing(order)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id, order.order_number)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail view */}
      {selected && (
        <OrderCard
          order={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Add order form */}
      {showAdd && (
        <OrderForm
          onClose={() => setShowAdd(false)}
          onSaved={fetchOrders}
        />
      )}

      {/* Edit order form */}
      {editing && (
        <OrderForm
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={fetchOrders}
        />
      )}
    </>
  );
}
