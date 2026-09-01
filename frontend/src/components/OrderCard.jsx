import { useState } from 'react';
import { X, User, Building2, Calendar, IndianRupee, Hash, Scissors } from 'lucide-react';
import DeadlineBadge from './DeadlineBadge';
import SplitBillModal from './SplitBillModal';
import CompleteOrderModal from './CompleteOrderModal';
import api from '../api/client';

const formatDate = (d) => { if (!d) return 'N/A'; const [y,m,day]=d.split('-'); return `${day}/${m}/${y}`; };
const formatINR = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

const STATUS_STYLES = {
  pending:   'bg-blue-100 text-blue-700',
  shipped:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function OrderCard({ order, onClose, onStatusChange }) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  if (!order) return null;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.patch(`/orders/${order.id}/status`, { status: 'cancelled' });
      onStatusChange(order.id, 'cancelled');
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  const isActive = !['completed','cancelled'].includes(order.status);

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-4 h-4 text-gray-400" />
              <span className="font-bold text-gray-900">{order.order_number}</span>
              <DeadlineBadge daysLeft={order.daysLeft} status={order.status} />
            </div>
            <p className="text-sm text-gray-500">{order.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400"/></button>
        </div>

        {/* Details */}
        <div className="p-5 space-y-3">
          <DetailRow icon={<Building2 className="w-4 h-4"/>} label="Customer"        value={order.customer_name} />
          <DetailRow icon={<User className="w-4 h-4"/>}      label="Salesman"        value={order.salesman_name || '—'} />
          <DetailRow icon={null}                             label="Salesman Email"   value={order.salesman_email || '—'} />
          <DetailRow icon={<Calendar className="w-4 h-4"/>}  label="Order Date"      value={formatDate(order.order_date)} />
          <DetailRow icon={<Calendar className="w-4 h-4"/>}  label="Delivery Deadline" value={formatDate(order.delivery_deadline)} highlight={order.daysLeft <= 3 && isActive} />
          <DetailRow icon={<IndianRupee className="w-4 h-4"/>} label="Amount"        value={formatINR(order.amount)} />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Status</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[order.status]||'bg-gray-100 text-gray-600'}`}>{order.status}</span>
          </div>
        </div>

        {/* Action buttons */}
        {isActive && (
          <div className="px-5 pb-5 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Update Status</p>
            <div className="flex gap-2">
              <button onClick={() => setShowComplete(true)}
                className="flex-1 py-2 text-sm font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                Mark Completed
              </button>
            </div>

            {/* Split Bill */}
            <button onClick={() => setShowSplit(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors">
              <Scissors className="w-4 h-4" /> Split Bill (Multiple Products)
            </button>

            {/* Cancel section */}
            {!confirmCancel ? (
              <button onClick={() => setConfirmCancel(true)}
                className="w-full py-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-100 rounded-lg transition-colors">
                Cancel Order
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                <p className="text-sm text-red-700 font-medium text-center">Are you sure you want to cancel this order?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmCancel(false)}
                    className="flex-1 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                    No, go back
                  </button>
                  <button onClick={handleCancel} disabled={cancelling}
                    className="flex-1 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60 transition-colors">
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {showSplit && <SplitBillModal order={order} onClose={() => setShowSplit(false)} />}
    {showComplete && (
      <CompleteOrderModal
        order={order}
        onDone={(updated) => onStatusChange(order.id, 'completed', updated)}
        onClose={() => setShowComplete(false)}
      />
    )}
    </>
  );
}

function DetailRow({ icon, label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        {icon && <span className="text-gray-400">{icon}</span>}{label}
      </div>
      <span className={`text-sm font-medium ${highlight ? 'text-orange-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}
