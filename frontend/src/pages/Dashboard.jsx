import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, AlertTriangle, Clock, Calendar, CheckCircle, Package, Plus } from 'lucide-react';
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

const STATUS_STYLES = {
  pending: 'bg-blue-50 text-blue-700 border border-blue-100',
  shipped: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
  completed: 'bg-green-50 text-green-700 border border-green-100',
};

function getRowClass(order) {
  if (order.status === 'completed') return 'bg-white hover:bg-gray-50';
  if (order.daysLeft < 0) return 'bg-red-50 hover:bg-red-100';
  if (order.daysLeft === 0) return 'bg-orange-50 hover:bg-orange-100';
  if (order.daysLeft <= 3) return 'bg-orange-50/60 hover:bg-orange-100/60';
  if (order.daysLeft <= 7) return 'bg-yellow-50 hover:bg-yellow-100';
  return 'bg-white hover:bg-gray-50';
}

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await api.post('/orders/sync');
      setSyncMsg(`✓ ${res.data.message}`);
      await fetchOrders();
    } catch {
      setSyncMsg('✗ Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  const handleStatusChange = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    setSelected(null);
    fetchOrders();
  };

  const filtered = orders
    .filter((o) =>
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.salesman_name.toLowerCase().includes(search.toLowerCase()) ||
      o.order_number.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      return a.daysLeft - b.daysLeft;
    });

  const active = orders.filter((o) => o.status === 'pending');
  const stats = {
    total: orders.filter(o => o.status !== 'cancelled').length,
    overdue: active.filter((o) => o.daysLeft < 0).length,
    today: active.filter((o) => o.daysLeft === 0).length,
    week: active.filter((o) => o.daysLeft > 0 && o.daysLeft <= 7).length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Live order deadline overview</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Order
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={<Package className="w-5 h-5" />} label="Total Orders" value={stats.total} color="text-blue-600" bg="bg-blue-50" />
          <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Overdue" value={stats.overdue} color="text-red-600" bg="bg-red-50" />
          <StatCard icon={<Clock className="w-5 h-5" />} label="Due Today" value={stats.today} color="text-orange-600" bg="bg-orange-50" />
          <StatCard icon={<Calendar className="w-5 h-5" />} label="Due This Week" value={stats.week} color="text-yellow-600" bg="bg-yellow-50" />
          <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Completed" value={stats.completed} color="text-green-600" bg="bg-green-50" />
        </div>

        {/* Search + Sync */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, salesman, or order #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            {syncMsg && <span className="text-sm text-gray-500">{syncMsg}</span>}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Tally'}
            </button>
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Deadline</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Days Left</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading orders...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">No orders found</td>
                  </tr>
                ) : (
                  filtered.map((order) => (
                    <tr
                      key={order.id}
                      className={`cursor-pointer transition-colors ${getRowClass(order)}`}
                      onClick={() => setSelected(order)}
                    >
                      <td className="px-4 py-3 font-medium text-blue-700">{order.order_number}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-[180px] truncate">{order.customer_name}</td>
                      <td className="px-4 py-3 text-gray-600">{order.salesman_name}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(order.delivery_deadline)}</td>
                      <td className="px-4 py-3">
                        <DeadlineBadge daysLeft={order.daysLeft} status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{formatINR(order.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[order.status] || ''}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <OrderCard
          order={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {showAdd && (
        <OrderForm
          onClose={() => setShowAdd(false)}
          onSaved={fetchOrders}
        />
      )}
    </>
  );
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4 flex flex-col gap-2`}>
      <div className={`${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}
