export default function DeadlineBadge({ daysLeft, status }) {
  if (status === 'cancelled') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">Cancelled</span>;
  }
  if (status === 'completed') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">Done</span>;
  }
  if (daysLeft === undefined || daysLeft === null) return null;
  if (daysLeft < 0) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300 uppercase tracking-wide">Overdue</span>;
  if (daysLeft === 0) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-600 text-white uppercase tracking-wide">Today</span>;
  if (daysLeft <= 3) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>;
  if (daysLeft <= 7) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">{daysLeft} days</span>;
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">{daysLeft} days</span>;
}
