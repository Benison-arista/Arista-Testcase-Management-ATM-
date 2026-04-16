import { X, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import useRunStore from '../../stores/useRunStore';

const STATUS_META = {
  pass:    { label: 'Pass',    color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  fail:    { label: 'Fail',    color: 'bg-red-100 text-red-700',     icon: XCircle },
  blocked: { label: 'Blocked', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600',   icon: Clock },
};

function ProgressBar({ pass, fail, blocked, pending, total }) {
  if (!total) return null;
  const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
  return (
    <div className="w-full h-3 rounded-full overflow-hidden flex">
      <div className="bg-green-400 transition-all" style={{ width: pct(pass) }} title={`Pass ${pct(pass)}`} />
      <div className="bg-red-400 transition-all" style={{ width: pct(fail) }} title={`Fail ${pct(fail)}`} />
      <div className="bg-orange-400 transition-all" style={{ width: pct(blocked) }} title={`Blocked ${pct(blocked)}`} />
      <div className="bg-gray-200 transition-all" style={{ width: pct(pending) }} title={`Pending ${pct(pending)}`} />
    </div>
  );
}

export default function ReportView({ onClose }) {
  const { report } = useRunStore();

  if (!report) return null;
  const { summary, details } = report;

  // Group details by run_folder_name
  const groups = {};
  details.forEach(d => {
    const g = d.run_folder_name;
    if (!groups[g]) groups[g] = [];
    groups[g].push(d);
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">Test Execution Report</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="px-5 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-6 mb-3">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${m.color}`}>{m.label}</span>
                <span className="text-lg font-bold text-gray-800">{summary[k] || 0}</span>
              </div>
            ))}
            <div className="ml-auto text-xs text-gray-500">Total: <strong>{summary.total}</strong></div>
          </div>
          <ProgressBar
            pass={+summary.pass}
            fail={+summary.fail}
            blocked={+summary.blocked}
            pending={+summary.pending}
            total={+summary.total}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {Object.entries(groups).map(([folderName, items]) => (
            <div key={folderName} className="mb-6">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{folderName}</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400">
                    <th className="text-left py-1.5 font-medium">Test Case</th>
                    <th className="text-left py-1.5 font-medium">Status</th>
                    <th className="text-left py-1.5 font-medium">Version</th>
                    <th className="text-left py-1.5 font-medium">Bugs</th>
                    <th className="text-left py-1.5 font-medium">Executed By</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const meta = STATUS_META[item.status] || STATUS_META.pending;
                    const Icon = meta.icon;
                    const title = item.data?.title || item.data?.description || `TC #${item.testcase_id}`;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 text-gray-800 max-w-xs truncate">{title}</td>
                        <td className="py-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
                            <Icon size={11} /> {meta.label}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500 text-xs">{item.version || '—'}</td>
                        <td className="py-2 text-gray-500 text-xs">{item.bugs || '—'}</td>
                        <td className="py-2 text-gray-500 text-xs">{item.executed_by || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {!details.length && <p className="text-sm text-gray-400 text-center py-8">No data to report.</p>}
        </div>

        <div className="px-5 py-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}
