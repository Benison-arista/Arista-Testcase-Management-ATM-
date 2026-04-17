import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, Trash2, Plus } from 'lucide-react';
import useRunStore from '../../stores/useRunStore';
import useAppStore from '../../stores/useAppStore';
import AddTCModal from './AddTCModal';
import TestRunsHome from './TestRunsHome';

// --- Resizable column handle ---
function ColHandle({ colKey, onResize }) {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    let lastX = e.clientX;
    const onMove = (e) => { const d = e.clientX - lastX; lastX = e.clientX; if (d !== 0) onResize(colKey, d); };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [colKey, onResize]);
  return (
    <div onMouseDown={handleMouseDown} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10" onClick={e => e.stopPropagation()}>
      <div className="absolute right-0 top-0 bottom-0 w-px transition-colors" style={{ background: '#b0c4de' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#3d8bfd'; e.currentTarget.style.width = '3px'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#b0c4de'; e.currentTarget.style.width = '1px'; }}
      />
    </div>
  );
}

function useResizableCols(defaults) {
  const [widths, setWidths] = useState(defaults);
  const resize = useCallback((key, delta) => {
    setWidths(prev => ({ ...prev, [key]: Math.max(40, (prev[key] || 60) + delta) }));
  }, []);
  return [widths, resize];
}

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
function DonutChart({ pass, fail, blocked, pending, total, size = 200 }) {
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="72" fill="none" stroke="#e5e7eb" strokeWidth="18" />
        <text x="100" y="100" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 24, fontWeight: 700, fill: '#9ca3af' }}>0%</text>
      </svg>
    );
  }

  const radius = 72;
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
    <svg width={size} height={size} viewBox="0 0 200 200">
      {segments.map((seg, i) => {
        const dashLength = (seg.value / total) * circumference;
        const dashOffset = -offset;
        offset += dashLength;
        return (
          <circle
            key={i}
            cx="100" cy="100" r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
          />
        );
      })}
      <text x="100" y="90" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 28, fontWeight: 700, fill: '#0e2e5b' }}>{completionPct}%</text>
      <text x="100" y="116" textAnchor="middle" style={{ fontSize: 12, fill: '#6b7280' }}>executed</text>
    </svg>
  );
}

// --- Status Select ---
const STATUS_LABELS = { pending: 'Pending', pass: 'Pass', fail: 'Failed', blocked: 'Blocked' };

function StatusSelect({ value, onChange }) {
  const statuses = ['pending', 'pass', 'fail', 'blocked'];
  return (
    <select value={value || 'pending'} onChange={e => onChange(e.target.value)} className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-arista-400">
      {statuses.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
    </select>
  );
}

// --- TC detail fields ---
const GRID_KEYS = ['qtest_id', 'testrail_id', 'priority', 'state', 'module', 'section', 'pillar', 'template', 'milestone', 'automatable_call', 'automation_status', 'automated_by', 'blocked_by', 'hardware_platforms', 'jira_defect', 'arista_id', 'type', 'owner', 'status'];
const GRID_LABELS = { qtest_id: 'qTest ID', testrail_id: 'TestRail ID', priority: 'Priority', state: 'State', module: 'Module', section: 'Section', pillar: 'Pillar', template: 'Template', milestone: 'Milestone', automatable_call: 'Automatable', automation_status: 'Automation Status', automated_by: 'Automated By', blocked_by: 'Blocked By', hardware_platforms: 'HW Platforms', jira_defect: 'Jira Defect', arista_id: 'Arista ID', type: 'Type', owner: 'Owner', status: 'Status' };
const FULL_WIDTH_KEYS = ['description', 'precondition', 'test_steps', 'expected_result'];
const FULL_WIDTH_LABELS = { description: 'Description', precondition: 'Precondition', test_steps: 'Test Steps', expected_result: 'Expected Result' };

function triId(id) {
  return 'TRI-' + String(id).padStart(5, '0');
}

function RunRow({ item, baseUrl, expandedId, checked, onCheck, edits, onEdit, selectMode, colWidths }) {
  const navigate = useNavigate();
  const { deleteRunItem } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const expanded = expandedId === item.id;
  const local = edits[item.id] || { status: item.status, version: item.version || '', bugs: item.bugs || '', comments: item.comments || '' };
  const set = (k, v) => onEdit(item.id, { ...local, [k]: v });
  const { icon: Icon, color } = STATUS_ICONS[local.status] || STATUS_ICONS.pending;
  const title = item.data?.title || item.data?.description || `TC #${item.testcase_id}`;
  const id = item.data?.qtest_id || item.data?.arista_id || item.testcase_id;
  const data = item.data || {};

  const gridFields = GRID_KEYS.filter(k => data[k] !== undefined && data[k] !== null && data[k] !== '');
  const fullWidthFields = FULL_WIDTH_KEYS.filter(k => data[k]);

  const toggleExpand = () => {
    if (expanded) navigate(baseUrl);
    else navigate(baseUrl + '/item/' + item.id);
  };

  const qtestId = data.qtest_id || '';
  const testrailId = data.testrail_id || '';
  const tcPriority = data.priority || '';
  const isNonPending = local.status !== 'pending';
  const isFailed = local.status === 'fail';
  const versionMissing = isNonPending && !local.version?.trim();
  const bugsMissing = isFailed && !local.bugs?.trim();

  const colCount = (selectMode ? 1 : 0) + 10; // checkbox + 9 data cols + actions

  return (
    <>
      <tr
        className="cursor-pointer transition-colors border-b border-gray-100"
        style={expanded ? { background: '#dbeafe' } : {}}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#e0eaf7'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = ''; }}
        onClick={toggleExpand}
      >
        {selectMode && <td className="px-1 py-2" onClick={e => e.stopPropagation()}><input type="checkbox" checked={checked} onChange={() => onCheck(item.id)} className="accent-arista-500" /></td>}
        <td className="px-2 py-2"><span className="font-mono font-semibold" style={{ color: '#1a56b0' }}>{triId(item.id)}</span></td>
        <td className="px-2 py-2 text-gray-500 font-mono truncate">{qtestId || <span className="text-gray-300">&mdash;</span>}</td>
        <td className="px-2 py-2 text-gray-500 font-mono truncate">{testrailId || <span className="text-gray-300">&mdash;</span>}</td>
        <td className="px-2 py-2"><p className="text-sm text-gray-800 truncate font-medium">{title}</p></td>
        <td className="px-2 py-2">
          {tcPriority && <span className={'px-1 py-0.5 rounded font-medium ' + (tcPriority === 'P1' ? 'bg-red-100 text-red-700' : tcPriority === 'P2' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600')}>{tcPriority}</span>}
        </td>
        <td className="px-2 py-2" onClick={e => e.stopPropagation()}><span className="flex items-center gap-1"><Icon size={14} className={color} /><StatusSelect value={local.status} onChange={v => set('status', v)} /></span></td>
        <td className="px-2 py-2" onClick={e => e.stopPropagation()}><input className="w-full border rounded px-1.5 py-0.5" style={{ borderColor: versionMissing ? '#ef4444' : '#e5e7eb' }} placeholder={isNonPending ? 'Version *' : 'Version'} value={local.version} onChange={e => set('version', e.target.value)} /></td>
        <td className="px-2 py-2" onClick={e => e.stopPropagation()}><input className="w-full border rounded px-1.5 py-0.5" style={{ borderColor: bugsMissing ? '#ef4444' : '#e5e7eb' }} placeholder={isFailed ? 'Bug ID *' : 'Bug ID(s)'} value={local.bugs} onChange={e => set('bugs', e.target.value)} /></td>
        <td className="px-2 py-2" onClick={e => e.stopPropagation()}><input className="w-full border border-gray-200 rounded px-1.5 py-0.5" placeholder="Notes" value={local.comments} onChange={e => set('comments', e.target.value)} /></td>
        <td className="px-1 py-2 text-right" onClick={e => e.stopPropagation()}>
          {canEdit && <button onClick={() => deleteRunItem(item.id)}><Trash2 size={12} className="text-gray-300 hover:text-red-500" /></button>}
        </td>
      </tr>

      {expanded && (
        <tr><td colSpan={colCount} className="p-0">
        <div className="px-6 py-4 mx-4 mb-2 rounded-lg" style={{ background: '#f8fafd', border: '1px solid #d0def4' }}>
          <h4 className="font-bold text-base mb-3" style={{ color: '#0e2e5b' }}>{data.title || data.description || ''}</h4>
          {gridFields.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-2 mb-3">
              {gridFields.map(key => (
                <div key={key}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#1a56b0' }}>{GRID_LABELS[key] || key}</p>
                  <p className="text-sm text-gray-800">{typeof data[key] === 'boolean' ? (data[key] ? 'Yes' : 'No') : String(data[key])}</p>
                </div>
              ))}
            </div>
          )}
          {fullWidthFields.map(key => (
            <div key={key} className="mt-3 pt-3" style={{ borderTop: '1px solid #d0def4' }}>
              <h5 className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#0e2e5b' }}>{FULL_WIDTH_LABELS[key]}</h5>
              <div className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg p-3 leading-relaxed" style={{ background: '#f0f5fc' }}>{String(data[key])}</div>
            </div>
          ))}
        </div>
        </td></tr>
      )}
    </>
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
  const [oCols, resizeOCol] = useResizableCols({ id: 90, name: 200, type: 70, total: 50, progress: 130, pass: 50, fail: 50, blocked: 55, pending: 55 });

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

  // Aggregate stats for the dashboard
  const totalTCs = allTestRuns.reduce((s, t) => s + (t.total || 0), 0);
  const totalPass = allTestRuns.reduce((s, t) => s + (t.pass || 0), 0);
  const totalFail = allTestRuns.reduce((s, t) => s + (t.fail || 0), 0);
  const totalBlocked = allTestRuns.reduce((s, t) => s + (t.blocked || 0), 0);
  const totalPending = allTestRuns.reduce((s, t) => s + (t.pending || 0), 0);
  const totalExecuted = totalPass + totalFail + totalBlocked;
  const executionPct = totalTCs > 0 ? Math.round((totalExecuted / totalTCs) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 py-4 shrink-0" style={{ borderBottom: '2px solid #d0def4', background: '#f8fafd' }}>
        <h2 style={{ color: '#0e2e5b' }} className="font-bold text-lg">{release?.name || 'Release'}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{allTestRuns.length} test run{allTestRuns.length !== 1 ? 's' : ''} &middot; {totalTCs} total TCs</p>
      </div>

      {/* Dashboard summary */}
      {allTestRuns.length > 0 && (
        <div className="flex items-start gap-8 px-5 py-5 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
          <div className="shrink-0">
            <DonutChart pass={totalPass} fail={totalFail} blocked={totalBlocked} pending={totalPending} total={totalTCs} size={180} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center max-w-[200px]">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} /><span className="text-xs text-gray-500">Pass: {totalPass}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} /><span className="text-xs text-gray-500">Fail: {totalFail}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /><span className="text-xs text-gray-500">Blocked: {totalBlocked}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#d1d5db' }} /><span className="text-xs text-gray-500">Pending: {totalPending}</span></div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0f5fc' }}><p className="text-2xl font-bold" style={{ color: '#0e2e5b' }}>{allTestRuns.length}</p><p className="text-xs text-gray-500">Test Runs</p></div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0f5fc' }}><p className="text-2xl font-bold" style={{ color: '#0e2e5b' }}>{totalTCs}</p><p className="text-xs text-gray-500">Total TCs</p></div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0fdf4' }}><p className="text-2xl font-bold text-green-600">{totalPass}</p><p className="text-xs text-gray-500">Passed</p></div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#fef2f2' }}><p className="text-2xl font-bold text-red-600">{totalFail}</p><p className="text-xs text-gray-500">Failed</p></div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#fffbeb' }}><p className="text-2xl font-bold text-orange-500">{totalBlocked}</p><p className="text-xs text-gray-500">Blocked</p></div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f9fafb' }}><p className="text-2xl font-bold text-gray-400">{totalPending}</p><p className="text-xs text-gray-500">Pending</p></div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#e8f0fe' }}><p className="text-2xl font-bold" style={{ color: '#1a56b0' }}>{executionPct}%</p><p className="text-xs text-gray-500">Executed</p></div>
            <div className="rounded-lg p-3 text-center" style={{ background: totalTCs > 0 && Math.round((totalPass / totalTCs) * 100) >= 80 ? '#f0fdf4' : '#fef2f2' }}><p className="text-2xl font-bold" style={{ color: totalTCs > 0 && Math.round((totalPass / totalTCs) * 100) >= 80 ? '#22c55e' : '#ef4444' }}>{totalTCs > 0 ? Math.round((totalPass / totalTCs) * 100) : 0}%</p><p className="text-xs text-gray-500">Pass Rate</p></div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {allTestRuns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No test runs yet. Add features in the Releases tab or create a test run from the sidebar.</p>
        ) : (
          <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
            <thead className="sticky top-0 z-10" style={{ background: '#e8f0fe', boxShadow: '0 1px 0 0 #d0def4' }}>
              <tr>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.id }}>ID<ColHandle colKey="id" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.name }}>Test Run<ColHandle colKey="name" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.type }}>Type<ColHandle colKey="type" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.total }}>Total<ColHandle colKey="total" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.progress }}>Progress<ColHandle colKey="progress" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.pass }}>Pass<ColHandle colKey="pass" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.fail }}>Fail<ColHandle colKey="fail" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.blocked }}>Blocked<ColHandle colKey="blocked" onResize={resizeOCol} /></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: oCols.pending }}>Pending<ColHandle colKey="pending" onResize={resizeOCol} /></th>
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
  const { itemId: urlItemId } = useParams();
  const { runItems, selectedRunFolderId, selectedFeatureId, selectedReleaseId, releaseTree, total, updateRunItem } = useRunStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [showAdd, setShowAdd] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [triColWidths, resizeTriCol] = useResizableCols({ id: 95, qtest: 85, testrail: 85, tc: 250, pri: 55, status: 100, version: 95, bugs: 95, notes: 85 });
  const expandedItemId = urlItemId ? parseInt(urlItemId, 10) : null;

  const hasEdits = Object.keys(edits).length > 0;

  const toggleCheck = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selectedIds.size === runItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(runItems.map(r => r.id)));
  };

  const handleEdit = (id, values) => {
    setEdits(prev => ({ ...prev, [id]: values }));
  };

  const handleBulkStatusUpdate = (status) => {
    setEdits(prev => {
      const next = { ...prev };
      selectedIds.forEach(id => {
        const item = runItems.find(r => r.id === id);
        next[id] = { ...(next[id] || { status: item?.status || 'pending', version: item?.version || '', bugs: item?.bugs || '', comments: item?.comments || '' }), status };
      });
      return next;
    });
  };

  const handleSave = async () => {
    // Validate: version required when status is not pending, bugs required when failed
    for (const [id, values] of Object.entries(edits)) {
      if (values.status !== 'pending' && !values.version?.trim()) {
        alert('Version is required when status is not pending. Please fill it for TRI-' + String(id).padStart(5, '0'));
        return;
      }
      if (values.status === 'fail' && !values.bugs?.trim()) {
        alert('Bug ID is required for failed test cases. Please fill it for TRI-' + String(id).padStart(5, '0'));
        return;
      }
    }
    setSaving(true);
    try {
      for (const [id, values] of Object.entries(edits)) {
        const item = runItems.find(r => r.id === parseInt(id));
        await updateRunItem(parseInt(id), { ...values, lock_version: item?.lock_version });
      }
      setEdits({});
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEdits({});
    setSelectedIds(new Set());
    setSelectMode(false);
  };

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

  // Base URL for this test run (used for TRI navigation)
  const baseUrl = selectedRunFolderId
    ? '/runs/release/' + selectedReleaseId + '/tr/' + selectedRunFolderId
    : '/runs/release/' + selectedReleaseId + '/feature/' + selectedFeatureId;

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
          <div className="flex items-center gap-2">
            {!selectMode && (
              <button
                onClick={() => setSelectMode(true)}
                style={{ color: '#1a56b0', borderColor: '#a1bde9', background: '#e8f0fe' }}
                className="flex items-center gap-1 text-xs font-semibold border rounded px-2.5 py-1.5 hover:opacity-85"
              >
                Select multiple
              </button>
            )}
            {selectMode && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 text-xs font-medium border border-gray-300 rounded px-2.5 py-1.5 text-gray-500 hover:bg-gray-100"
              >
                Exit selection
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              style={{ color: '#0e6856', borderColor: '#6ee7b7', background: '#ecfdf5' }}
              className="flex items-center gap-1 text-xs font-semibold border rounded px-2.5 py-1.5 hover:opacity-85"
            >
              <Plus size={13} /> Add TCs
            </button>
          </div>
        )}
      </div>

      {/* Summary with donut chart */}
      <div className="flex items-start gap-8 px-5 py-5 shrink-0" style={{ borderBottom: '1px solid #d0def4', background: '#f8fafd' }}>
        <div className="flex flex-col items-center shrink-0">
          <DonutChart pass={pass} fail={fail} blocked={blocked} pending={pending} total={itemTotal} size={220} />
          {/* Legend below donut */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 justify-center max-w-[240px]">
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} /><span className="text-xs text-gray-600">Pass: <strong>{pass}</strong></span></div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} /><span className="text-xs text-gray-600">Fail: <strong>{fail}</strong></span></div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} /><span className="text-xs text-gray-600">Blocked: <strong>{blocked}</strong></span></div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#d1d5db' }} /><span className="text-xs text-gray-600">Pending: <strong>{pending}</strong></span></div>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-4">{pass + fail + blocked} of {itemTotal} test cases executed</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0f5fc' }}>
              <p className="text-2xl font-bold" style={{ color: '#0e2e5b' }}>{itemTotal}</p>
              <p className="text-xs text-gray-500">Total TCs</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0fdf4' }}>
              <p className="text-2xl font-bold text-green-600">{pass}</p>
              <p className="text-xs text-gray-500">Passed</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#fef2f2' }}>
              <p className="text-2xl font-bold text-red-600">{fail}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#fffbeb' }}>
              <p className="text-2xl font-bold text-orange-500">{blocked}</p>
              <p className="text-xs text-gray-500">Blocked</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f9fafb' }}>
              <p className="text-2xl font-bold text-gray-400">{pending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#e8f0fe' }}>
              <p className="text-2xl font-bold" style={{ color: '#1a56b0' }}>{itemTotal > 0 ? Math.round(((pass + fail + blocked) / itemTotal) * 100) : 0}%</p>
              <p className="text-xs text-gray-500">Executed</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: itemTotal > 0 && Math.round((pass / itemTotal) * 100) >= 80 ? '#f0fdf4' : itemTotal > 0 && Math.round((pass / itemTotal) * 100) >= 50 ? '#fffbeb' : '#fef2f2' }}>
              <p className="text-2xl font-bold" style={{ color: itemTotal > 0 && Math.round((pass / itemTotal) * 100) >= 80 ? '#22c55e' : itemTotal > 0 && Math.round((pass / itemTotal) * 100) >= 50 ? '#f59e0b' : '#ef4444' }}>{itemTotal > 0 ? Math.round((pass / itemTotal) * 100) : 0}%</p>
              <p className="text-xs text-gray-500">Pass Rate</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f9fafb' }}>
              <p className="text-2xl font-bold text-gray-500">{itemTotal - (pass + fail + blocked)}</p>
              <p className="text-xs text-gray-500">Remaining</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 shrink-0" style={{ background: '#dbeafe', borderBottom: '1px solid #a1bde9' }}>
          <span className="text-xs font-semibold" style={{ color: '#0e2e5b' }}>{selectedIds.size} selected</span>
          <span className="text-xs text-gray-400">Set status:</span>
          {['pass', 'fail', 'blocked', 'pending'].map(s => (
            <button key={s} onClick={() => handleBulkStatusUpdate(s)} className="text-xs px-2 py-0.5 rounded font-medium border" style={{
              background: s === 'pass' ? '#d1fae5' : s === 'fail' ? '#fee2e2' : s === 'blocked' ? '#fef3c7' : '#f3f4f6',
              color: s === 'pass' ? '#065f46' : s === 'fail' ? '#991b1b' : s === 'blocked' ? '#92400e' : '#374151',
              borderColor: s === 'pass' ? '#6ee7b7' : s === 'fail' ? '#fca5a5' : s === 'blocked' ? '#fcd34d' : '#d1d5db',
            }}>{STATUS_LABELS[s]}</button>
          ))}
        </div>
      )}

      {/* TC table — single table for header + all rows */}
      <div className="flex-1 overflow-y-auto">
        {runItems.length > 0 ? (
          <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {selectMode && <col style={{ width: 30 }} />}
              <col style={{ width: triColWidths.id }} />
              <col style={{ width: triColWidths.qtest }} />
              <col style={{ width: triColWidths.testrail }} />
              <col style={{ width: triColWidths.tc }} />
              <col style={{ width: triColWidths.pri }} />
              <col style={{ width: triColWidths.status }} />
              <col style={{ width: triColWidths.version }} />
              <col style={{ width: triColWidths.bugs }} />
              <col style={{ width: triColWidths.notes }} />
              <col style={{ width: hasEdits ? 120 : 28 }} />
            </colgroup>
            <thead className="sticky top-0 z-10" style={{ background: '#e8f0fe', boxShadow: '0 1px 0 0 #d0def4' }}>
              <tr>
                {selectMode && <th className="px-1 py-2 text-left"><input type="checkbox" checked={selectedIds.size === runItems.length && runItems.length > 0} onChange={toggleAll} className="accent-arista-500" /></th>}
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">ID<ColHandle colKey="id" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">qTest ID<ColHandle colKey="qtest" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">TestRail<ColHandle colKey="testrail" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">Test Case<ColHandle colKey="tc" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">Pri<ColHandle colKey="pri" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">Status<ColHandle colKey="status" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">Version<ColHandle colKey="version" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">Bugs<ColHandle colKey="bugs" onResize={resizeTriCol} /></th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase relative">Notes<ColHandle colKey="notes" onResize={resizeTriCol} /></th>
                <th className="px-1 py-2 text-right">
                  {hasEdits && canEdit && (
                    <span className="flex items-center justify-end gap-1">
                      <button onClick={handleSave} disabled={saving} className="font-semibold px-2 py-0.5 rounded whitespace-nowrap" style={{ color: '#fff', background: saving ? '#9ca3af' : '#22c55e' }}>{saving ? '...' : 'Save'}</button>
                      <button onClick={handleCancel} className="font-medium px-2 py-0.5 rounded text-gray-500 hover:bg-gray-200 whitespace-nowrap">Cancel</button>
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {runItems.map(item => (
                <RunRow
                  key={item.id}
                  item={item}
                  baseUrl={baseUrl}
                  expandedId={expandedItemId}
                  checked={selectedIds.has(item.id)}
                  onCheck={toggleCheck}
                  edits={edits}
                  onEdit={handleEdit}
                  selectMode={selectMode}
                  colWidths={triColWidths}
                />
              ))}
            </tbody>
          </table>
        ) : (
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
    return <TestRunsHome />;
  }

  // If a specific test run or feature run is selected, show the detail view
  if (selectedRunFolderId || selectedFeatureId) {
    return <TestRunDetail />;
  }

  // Otherwise show the release overview with list of all test runs
  return <ReleaseOverview releaseTree={releaseTree} selectedReleaseId={selectedReleaseId} />;
}
