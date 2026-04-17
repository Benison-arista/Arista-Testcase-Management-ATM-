import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, Trash2, Plus } from 'lucide-react';
import useRunStore from '../../stores/useRunStore';
import useAppStore from '../../stores/useAppStore';
import AddTCModal from './AddTCModal';

const STATUS_ICONS = {
  pass:    { icon: CheckCircle,  color: 'text-green-500' },
  fail:    { icon: XCircle,     color: 'text-red-500' },
  blocked: { icon: AlertCircle, color: 'text-orange-500' },
  pending: { icon: Clock,       color: 'text-gray-400' },
};

const STATUS_COLORS = {
  pass: '#22c55e',
  fail: '#ef4444',
  blocked: '#f59e0b',
  pending: '#d1d5db',
};

// --- Donut Chart (SVG) ---
function DonutChart({ pass, fail, blocked, pending, total, size = 140 }) {
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e5e7eb" strokeWidth="16" />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central" className="text-sm font-bold fill-gray-400">0%</text>
      </svg>
    );
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: pass, color: STATUS_COLORS.pass },
    { value: fail, color: STATUS_COLORS.fail },
    { value: blocked, color: STATUS_COLORS.blocked },
    { value: pending, color: STATUS_COLORS.pending },
  ].filter(s => s.value > 0);

  let offset = 0;
  const completionPct = total > 0 ? Math.round(((pass + fail + blocked) / total) * 100) : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 140 140">
      {segments.map((seg, i) => {
        const dashLength = (seg.value / total) * circumference;
        const dashOffset = -offset;
        offset += dashLength;
        return (
          <circle
            key={i}
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 70 70)"
          />
        );
      })}
      <text x="70" y="64" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 22, fontWeight: 700, fill: '#0e2e5b' }}>{completionPct}%</text>
      <text x="70" y="84" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fill: '#6b7280' }}>executed</text>
    </svg>
  );
}

// --- Status Select ---
function StatusSelect({ value, onChange }) {
  const statuses = ['pending', 'pass', 'fail', 'blocked'];
  return (
    <select value={value || 'pending'} onChange={e => onChange(e.target.value)} className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-arista-400">
      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// --- Single TC Row in a test run ---
function triId(id) {
  return 'TRI-' + String(id).padStart(5, '0');
}

function RunRow({ item }) {
  const { updateRunItem, deleteRunItem } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [local, setLocal] = useState({ status: item.status, version: item.version || '', bugs: item.bugs || '', comments: item.comments || '' });
  const [dirty, setDirty] = useState(false);
  const set = (k, v) => { setLocal(p => ({ ...p, [k]: v })); setDirty(true); };
  const save = async () => { await updateRunItem(item.id, { ...local, lock_version: item.lock_version }); setDirty(false); };
  const { icon: Icon, color } = STATUS_ICONS[local.status] || STATUS_ICONS.pending;
  const title = item.data?.title || item.data?.description || `TC #${item.testcase_id}`;
  const id = item.data?.qtest_id || item.data?.arista_id || item.testcase_id;

  return (
    <div className="px-4 py-2.5 border-b border-gray-100 last:border-0 grid grid-cols-12 gap-2 items-start">
      <div className="col-span-1">
        <span className="text-xs font-mono font-semibold" style={{ color: '#1a56b0' }}>{triId(item.id)}</span>
      </div>
      <div className="col-span-3 min-w-0">
        <p className="text-sm text-gray-800 truncate font-medium">{title}</p>
        <p className="text-xs text-gray-400">{id} &middot; {item.section}</p>
      </div>
      <div className="col-span-2 flex items-center gap-1.5"><Icon size={14} className={color} /><StatusSelect value={local.status} onChange={v => set('status', v)} /></div>
      <div className="col-span-2"><input className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs" placeholder="Version" value={local.version} onChange={e => set('version', e.target.value)} /></div>
      <div className="col-span-2"><input className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs" placeholder="Bug ID(s)" value={local.bugs} onChange={e => set('bugs', e.target.value)} /></div>
      <div className="col-span-1"><input className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs" placeholder="Notes" value={local.comments} onChange={e => set('comments', e.target.value)} /></div>
      <div className="col-span-1 flex items-center gap-1 justify-end">
        {dirty && canEdit && <button onClick={save} className="text-xs font-medium" style={{ color: '#1a56b0' }}>Save</button>}
        {canEdit && <button onClick={() => deleteRunItem(item.id)}><Trash2 size={13} className="text-gray-300 hover:text-red-500" /></button>}
      </div>
    </div>
  );
}

function runId(source, id) {
  return source === 'feature' ? 'TR-F' + String(id).padStart(4, '0') : 'TR-' + String(id).padStart(4, '0');
}

const SOURCE_BADGE = {
  feature: { bg: '#cffafe', color: '#0e7490', label: 'Feature' },
  manual:  { bg: '#e8f0fe', color: '#1a56b0', label: 'Manual' },
};

// --- Release overview: list ALL test runs (features + manual) ---
function ReleaseOverview({ releaseTree, selectedReleaseId }) {
  const navigate = useNavigate();
  const { selectTestRun, selectFeatureRun, allTestRuns } = useRunStore();

  // Find release name
  function findRelease(nodes) {
    for (const n of nodes) {
      if (n.id === selectedReleaseId) return n;
      const found = findRelease(n.children || []);
      if (found) return found;
    }
    return null;
  }
  const release = findRelease(releaseTree);

  const handleRowClick = (tr) => {
    if (tr.source === 'feature') {
      navigate('/runs/release/' + selectedReleaseId + '/feature/' + tr.id);
      selectFeatureRun(selectedReleaseId, tr.id);
    } else {
      navigate('/runs/release/' + selectedReleaseId + '/tr/' + tr.id);
      selectTestRun(tr.id, selectedReleaseId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
        <h2 style={{ color: '#0e2e5b' }} className="font-bold text-lg">{release?.name || 'Release'}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{allTestRuns.length} test run{allTestRuns.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {allTestRuns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No test runs yet. Add features in the Releases tab or create a test run from the sidebar.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10" style={{ background: '#e8f0fe', boxShadow: '0 1px 0 0 #d0def4' }}>
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Test Run</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Progress</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Pass</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Fail</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Blocked</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Pending</th>
              </tr>
            </thead>
            <tbody>
              {allTestRuns.map(tr => {
                const pct = tr.total > 0 ? Math.round(((tr.pass + tr.fail + tr.blocked) / tr.total) * 100) : 0;
                const badge = SOURCE_BADGE[tr.source] || SOURCE_BADGE.manual;
                return (
                  <tr
                    key={tr.source + '-' + tr.id}
                    onClick={() => handleRowClick(tr)}
                    className="cursor-pointer transition-colors border-b border-gray-100"
                    onMouseEnter={e => { e.currentTarget.style.background = '#e0eaf7'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    <td className="px-4 py-3"><span className="text-xs font-mono font-semibold" style={{ color: '#1a56b0' }}>{runId(tr.source, tr.id)}</span></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{tr.name}</p>
                      {tr.priority && <span className="text-xs text-gray-400">{tr.priority}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{tr.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-2 w-20 rounded-full overflow-hidden bg-gray-200">
                          {tr.pass > 0 && <div style={{ width: (tr.pass / (tr.total || 1) * 100) + '%', background: STATUS_COLORS.pass }} />}
                          {tr.fail > 0 && <div style={{ width: (tr.fail / (tr.total || 1) * 100) + '%', background: STATUS_COLORS.fail }} />}
                          {tr.blocked > 0 && <div style={{ width: (tr.blocked / (tr.total || 1) * 100) + '%', background: STATUS_COLORS.blocked }} />}
                        </div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-medium text-green-600">{tr.pass}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-medium text-red-600">{tr.fail}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-medium text-orange-500">{tr.blocked}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-400">{tr.pending}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --- Test Run Detail: donut chart + summary + TC list ---
function TestRunDetail() {
  const { runItems, selectedRunFolderId, selectedFeatureId, selectedReleaseId, releaseTree, total } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [showAdd, setShowAdd] = useState(false);

  // Determine run name and ID format
  let runName = '';
  let displayId = '';
  if (selectedRunFolderId) {
    // Manual test run
    function findRun(nodes) {
      for (const n of nodes) {
        const tr = n.testRuns?.find(t => t.id === selectedRunFolderId);
        if (tr) { runName = tr.name; return; }
        findRun(n.children || []);
      }
    }
    findRun(releaseTree);
    displayId = 'TR-' + String(selectedRunFolderId).padStart(4, '0');
  } else if (selectedFeatureId) {
    // Feature-based test run
    function findFeature(nodes) {
      for (const n of nodes) {
        const f = n.features?.find(f => f.id === selectedFeatureId);
        if (f) { runName = f.name; return; }
        findFeature(n.children || []);
      }
    }
    findFeature(releaseTree);
    displayId = 'TR-F' + String(selectedFeatureId).padStart(4, '0');
  }

  // Compute stats from items
  const pass = runItems.filter(r => r.status === 'pass').length;
  const fail = runItems.filter(r => r.status === 'fail').length;
  const blocked = runItems.filter(r => r.status === 'blocked').length;
  const pending = runItems.filter(r => r.status === 'pending').length;
  const itemTotal = runItems.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: '#e8f0fe', color: '#1a56b0' }}>{displayId}</span>
            <h2 style={{ color: '#0e2e5b' }} className="font-bold text-lg">{runName}</h2>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            style={{ color: '#0e6856', borderColor: '#6ee7b7', background: '#ecfdf5' }}
            className="flex items-center gap-1 text-xs font-semibold border rounded px-2.5 py-1.5 hover:opacity-85"
          >
            <Plus size={13} /> Add TCs
          </button>
        )}
      </div>

      {/* Summary with donut chart */}
      <div className="flex items-start gap-6 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #d0def4', background: '#f8fafd' }}>
        <DonutChart pass={pass} fail={fail} blocked={blocked} pending={pending} total={itemTotal} />
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#0e2e5b' }}>{itemTotal}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total TCs</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{pass}</p>
            <p className="text-xs text-gray-500 mt-0.5">Passed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{fail}</p>
            <p className="text-xs text-gray-500 mt-0.5">Failed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{blocked}</p>
            <p className="text-xs text-gray-500 mt-0.5">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-400">{pending}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#1a56b0' }}>{itemTotal > 0 ? Math.round(((pass + fail + blocked) / itemTotal) * 100) : 0}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Executed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{itemTotal > 0 ? Math.round((pass / itemTotal) * 100) : 0}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Pass Rate</p>
          </div>
        </div>
      </div>

      {/* Column headers */}
      {runItems.length > 0 && (
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-500 shrink-0" style={{ background: '#e8f0fe', boxShadow: '0 1px 0 0 #d0def4' }}>
          <span className="col-span-1">ID</span>
          <span className="col-span-3">Test Case</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Version</span>
          <span className="col-span-2">Bugs</span>
          <span className="col-span-1">Notes</span>
          <span className="col-span-1" />
        </div>
      )}

      {/* TC list */}
      <div className="flex-1 overflow-y-auto">
        {runItems.map(item => <RunRow key={item.id} item={item} />)}
        {!runItems.length && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <p className="text-sm">No test cases in this run yet.</p>
            {canEdit && <button onClick={() => setShowAdd(true)} className="text-xs underline" style={{ color: '#1a56b0' }}>Add test cases</button>}
          </div>
        )}
      </div>

      {showAdd && <AddTCModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// --- Main export ---
export default function RunItemList() {
  const { selectedReleaseId, selectedRunFolderId, selectedFeatureId, releaseTree } = useRunStore();

  if (!selectedReleaseId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a release to view test runs.
      </div>
    );
  }

  // If a specific test run or feature run is selected, show the detail view
  if (selectedRunFolderId || selectedFeatureId) {
    return <TestRunDetail />;
  }

  // Otherwise show the release overview with list of all test runs
  return <ReleaseOverview releaseTree={releaseTree} selectedReleaseId={selectedReleaseId} />;
}
