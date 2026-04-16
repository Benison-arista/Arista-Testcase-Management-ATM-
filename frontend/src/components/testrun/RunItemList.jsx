import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, Trash2, Plus, BarChart2 } from 'lucide-react';
import useRunStore from '../../stores/useRunStore';
import useAppStore from '../../stores/useAppStore';
import AddTCModal from './AddTCModal';
import ReportView from './ReportView';

const STATUS_ICONS = {
  pass:    { icon: CheckCircle,  color: 'text-green-500' },
  fail:    { icon: XCircle,     color: 'text-red-500' },
  blocked: { icon: AlertCircle, color: 'text-orange-500' },
  pending: { icon: Clock,       color: 'text-gray-400' },
};

function StatusSelect({ value, onChange }) {
  const statuses = ['pending', 'pass', 'fail', 'blocked'];
  return (
    <select
      value={value || 'pending'}
      onChange={e => onChange(e.target.value)}
      className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-arista-400"
    >
      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function RunRow({ item }) {
  const { updateRunItem, deleteRunItem } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [local, setLocal] = useState({ status: item.status, version: item.version || '', bugs: item.bugs || '', comments: item.comments || '' });
  const [dirty, setDirty] = useState(false);

  const set = (k, v) => { setLocal(p => ({ ...p, [k]: v })); setDirty(true); };

  const save = async () => {
    await updateRunItem(item.id, { ...local, lock_version: item.lock_version });
    setDirty(false);
  };

  const { icon: Icon, color } = STATUS_ICONS[local.status] || STATUS_ICONS.pending;

  const title = item.data?.title || item.data?.description || `TC #${item.testcase_id}`;
  const id = item.data?.qtest_id || item.data?.arista_id || item.testcase_id;

  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-0 grid grid-cols-12 gap-2 items-start">
      <div className="col-span-4 min-w-0">
        <p className="text-sm text-gray-800 truncate font-medium">{title}</p>
        <p className="text-xs text-gray-400">{id} · {item.section}</p>
      </div>

      <div className="col-span-2 flex items-center gap-1.5">
        <Icon size={14} className={color} />
        <StatusSelect value={local.status} onChange={v => set('status', v)} />
      </div>

      <div className="col-span-2">
        <input
          className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs"
          placeholder="Version"
          value={local.version}
          onChange={e => set('version', e.target.value)}
        />
      </div>

      <div className="col-span-2">
        <input
          className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs"
          placeholder="Bug ID(s)"
          value={local.bugs}
          onChange={e => set('bugs', e.target.value)}
        />
      </div>

      <div className="col-span-1">
        <input
          className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs"
          placeholder="Notes"
          value={local.comments}
          onChange={e => set('comments', e.target.value)}
        />
      </div>

      <div className="col-span-1 flex items-center gap-1 justify-end">
        {dirty && canEdit && (
          <button onClick={save} className="text-xs text-arista-500 font-medium hover:text-arista-700">Save</button>
        )}
        {canEdit && (
          <button onClick={() => deleteRunItem(item.id)}><Trash2 size={13} className="text-gray-300 hover:text-red-500" /></button>
        )}
      </div>
    </div>
  );
}

export default function RunItemList() {
  const { runItems, selectedRunFolderId, fetchReport, total } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [showAdd, setShowAdd] = useState(false);
  const [showReport, setShowReport] = useState(false);

  if (!selectedRunFolderId) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a release or feature folder to view test runs.
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div>
          <span className="text-sm font-medium text-gray-700">
            {total || runItems.length} test case{(total || runItems.length) !== 1 ? 's' : ''}
          </span>
          {runItems.length > 0 && (
            <span className="ml-3 text-xs text-gray-400">
              Pass: {runItems.filter(r => r.status === 'pass').length} ·
              Fail: {runItems.filter(r => r.status === 'fail').length} ·
              Blocked: {runItems.filter(r => r.status === 'blocked').length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchReport(selectedRunFolderId); setShowReport(true); }}
            className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded px-2.5 py-1.5 hover:bg-gray-50"
          >
            <BarChart2 size={13} /> Report
          </button>
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-xs text-arista-500 border border-arista-200 rounded px-2.5 py-1.5 hover:bg-arista-50"
            >
              <Plus size={13} /> Add TCs
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      {runItems.length > 0 && (
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-100 shrink-0">
          <span className="col-span-4">Test Case</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Version</span>
          <span className="col-span-2">Bugs</span>
          <span className="col-span-1">Notes</span>
          <span className="col-span-1" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {runItems.map(item => <RunRow key={item.id} item={item} />)}
        {!runItems.length && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <p className="text-sm">No test cases in this run yet.</p>
            {canEdit && (
              <button onClick={() => setShowAdd(true)} className="text-xs text-arista-500 underline">Add test cases</button>
            )}
          </div>
        )}
      </div>

      {showAdd && <AddTCModal onClose={() => setShowAdd(false)} />}
      {showReport && <ReportView onClose={() => setShowReport(false)} />}
    </div>
  );
}
