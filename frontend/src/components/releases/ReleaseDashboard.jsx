import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Play, Bug, AlertTriangle } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';

function ColHandle({ colKey, onResize }) {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
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

const STATUS_COLORS = {
  requested: '#9ca3af', committed: '#3b82f6', in_progress: '#f59e0b',
  dev_complete: '#a855f7', in_testing: '#06b6d4', completed: '#22c55e', deferred: '#ef4444',
};
const STATUS_LABELS = {
  requested: 'Requested', committed: 'Committed', in_progress: 'In Progress',
  dev_complete: 'Dev Complete', in_testing: 'In Testing', completed: 'Completed', deferred: 'Deferred',
};
const PRIORITY_STYLE = {
  P0: { bg: '#fee2e2', color: '#991b1b' }, P1: { bg: '#ffedd5', color: '#9a3412' },
  P2: { bg: '#fef9c3', color: '#854d0e' }, P3: { bg: '#f3f4f6', color: '#374151' },
};
const RUN_STATUS_COLORS = { pass: '#22c55e', fail: '#ef4444', blocked: '#f59e0b', pending: '#d1d5db' };

function DonutChart({ segments, total, size = 200, label, centerText }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        <text x="100" y="92" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 28, fontWeight: 700, fill: '#9ca3af' }}>0</text>
        <text x="100" y="116" textAnchor="middle" style={{ fontSize: 12, fill: '#9ca3af' }}>{label}</text>
      </svg>
    );
  }
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const dashOff = -offset;
        offset += dash;
        return <circle key={i} cx="100" cy="100" r={radius} fill="none" stroke={seg.color} strokeWidth="18" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={dashOff} transform="rotate(-90 100 100)" />;
      })}
      <text x="100" y="90" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 30, fontWeight: 700, fill: '#0e2e5b' }}>{centerText || total}</text>
      <text x="100" y="116" textAnchor="middle" style={{ fontSize: 12, fill: '#6b7280' }}>{label}</text>
    </svg>
  );
}

function rfeId(id) { return 'RFE-' + String(id).padStart(4, '0'); }
function runId(source, id) { return source === 'feature' ? 'TR-F' + String(id).padStart(4, '0') : 'TR-' + String(id).padStart(4, '0'); }

function StatCard({ value, label, color, bg, size = 'md' }) {
  const textSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  const padding = size === 'lg' ? 'p-4' : size === 'sm' ? 'p-2' : 'p-3';
  const labelSize = size === 'lg' ? 'text-sm' : 'text-xs';
  return (
    <div className={`rounded-lg ${padding} text-center`} style={{ background: bg || '#f0f5fc' }}>
      <p className={`${textSize} font-bold`} style={{ color: color || '#0e2e5b' }}>{value}</p>
      <p className={`${labelSize} text-gray-500 mt-0.5`}>{label}</p>
    </div>
  );
}

export default function ReleaseDashboard() {
  const navigate = useNavigate();
  const { selectedReleaseId, features, summary, testRuns, tree } = useReleaseStore();
  const [fCols, resizeFCol] = useResizableCols({ id: 80, name: 250, status: 100, pri: 60, dev: 100, qa: 100 });
  const [trCols, resizeTrCol] = useResizableCols({ id: 90, name: 200, type: 70, total: 50, progress: 130, pass: 50, fail: 50, blocked: 55, pending: 55 });

  function findRelease(nodes) {
    for (const n of nodes) {
      if (n.id === selectedReleaseId) return n;
      const found = findRelease(n.children || []);
      if (found) return found;
    }
    return null;
  }
  const release = findRelease(tree);

  // Feature status segments
  const featureSegments = Object.entries(STATUS_COLORS).map(([status, color]) => ({
    value: features.filter(f => f.status === status).length, color, label: STATUS_LABELS[status],
  }));
  const featureTotal = features.length;
  const featuresCompleted = features.filter(f => f.status === 'completed').length;

  // Test run aggregate stats
  const totalTCs = testRuns.reduce((s, t) => s + (t.total || 0), 0);
  const totalPass = testRuns.reduce((s, t) => s + (t.pass || 0), 0);
  const totalFail = testRuns.reduce((s, t) => s + (t.fail || 0), 0);
  const totalBlocked = testRuns.reduce((s, t) => s + (t.blocked || 0), 0);
  const totalPending = testRuns.reduce((s, t) => s + (t.pending || 0), 0);
  const totalExecuted = totalPass + totalFail + totalBlocked;
  const executionPct = totalTCs > 0 ? Math.round((totalExecuted / totalTCs) * 100) : 0;
  const passPct = totalTCs > 0 ? Math.round((totalPass / totalTCs) * 100) : 0;
  const failPct = totalTCs > 0 ? Math.round((totalFail / totalTCs) * 100) : 0;
  const runSegments = [
    { value: totalPass, color: RUN_STATUS_COLORS.pass },
    { value: totalFail, color: RUN_STATUS_COLORS.fail },
    { value: totalBlocked, color: RUN_STATUS_COLORS.blocked },
    { value: totalPending, color: RUN_STATUS_COLORS.pending },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '2px solid #d0def4', background: '#f8fafd' }}>
        <h1 style={{ color: '#0e2e5b' }} className="text-xl font-bold">{release?.name || 'Release'}</h1>
        <div className="flex items-center gap-3 mt-1">
          {release?.status && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: release.status === 'active' ? '#dbeafe' : release.status === 'released' ? '#d1fae5' : '#f3f4f6', color: release.status === 'active' ? '#1e40af' : release.status === 'released' ? '#065f46' : '#374151' }}>
              {release.status}
            </span>
          )}
          {release?.target_date && <span className="text-xs text-gray-400">Target: {new Date(release.target_date).toLocaleDateString()}</span>}
          {release?.description && <span className="text-xs text-gray-500">{release.description}</span>}
        </div>
      </div>

      {/* Feature Overview — large */}
      <div className="px-6 py-6 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-5" style={{ color: '#0e2e5b' }}>Feature Status</h2>
        <div className="flex items-start gap-10 flex-wrap">
          <DonutChart segments={featureSegments} total={featureTotal} label="Features" centerText={featuresCompleted + '/' + featureTotal} size={260} />
          <div className="flex-1 min-w-[300px]">
            <p className="text-sm text-gray-600 mb-4">{featuresCompleted} of {featureTotal} features completed</p>
            {/* Feature stat cards — large */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard value={featureTotal} label="Total Features" size="lg" />
              <StatCard value={featuresCompleted} label="Completed" color="#22c55e" bg="#f0fdf4" size="lg" />
              <StatCard value={features.filter(f => f.status === 'in_progress' || f.status === 'in_testing').length} label="In Progress" color="#f59e0b" bg="#fffbeb" size="lg" />
              <StatCard value={features.filter(f => f.status === 'deferred').length} label="Deferred" color="#ef4444" bg="#fef2f2" size="lg" />
            </div>
            {/* Feature status legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {featureSegments.filter(s => s.value > 0).map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm text-gray-600">{s.label}: <strong>{s.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Test Execution Overview — smaller, below features */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
        <h2 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#0e2e5b' }}>Test Execution</h2>
        <div className="flex items-start gap-8 flex-wrap">
          <DonutChart segments={runSegments} total={totalTCs} label="Test Cases" centerText={executionPct + '%'} size={200} />
          <div className="flex-1 min-w-[280px]">
            <p className="text-xs text-gray-500 mb-3">{totalExecuted} of {totalTCs} test cases executed across {testRuns.length} test runs</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <StatCard value={totalTCs} label="Total TCs" size="sm" />
              <StatCard value={totalPass} label="Passed" color="#22c55e" bg="#f0fdf4" size="sm" />
              <StatCard value={totalFail} label="Failed" color="#ef4444" bg="#fef2f2" size="sm" />
              <StatCard value={totalBlocked} label="Blocked" color="#f59e0b" bg="#fffbeb" size="sm" />
              <StatCard value={totalPending} label="Pending" color="#6b7280" bg="#f9fafb" size="sm" />
              <StatCard value={passPct + '%'} label="Pass Rate" color={passPct >= 80 ? '#22c55e' : passPct >= 50 ? '#f59e0b' : '#ef4444'} bg={passPct >= 80 ? '#f0fdf4' : passPct >= 50 ? '#fffbeb' : '#fef2f2'} size="sm" />
              <StatCard value={executionPct + '%'} label="Execution" color="#1a56b0" bg="#e8f0fe" size="sm" />
              <StatCard value={totalTCs - totalExecuted} label="Remaining" color="#6b7280" bg="#f9fafb" size="sm" />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} /><span className="text-xs text-gray-500">Pass: {totalPass}</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} /><span className="text-xs text-gray-500">Fail: {totalFail}</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} /><span className="text-xs text-gray-500">Blocked: {totalBlocked}</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#d1d5db' }} /><span className="text-xs text-gray-500">Pending: {totalPending}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
        <h2 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#0e2e5b' }}>
          <Tag size={12} className="inline mr-1.5" />Features ({features.length})
        </h2>
        {features.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No features added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: '#e8f0fe' }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: fCols.id }}>ID<ColHandle colKey="id" onResize={resizeFCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: fCols.name }}>Feature<ColHandle colKey="name" onResize={resizeFCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: fCols.status }}>Status<ColHandle colKey="status" onResize={resizeFCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: fCols.pri }}>Priority<ColHandle colKey="pri" onResize={resizeFCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: fCols.dev }}>Dev<ColHandle colKey="dev" onResize={resizeFCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: fCols.qa }}>QA<ColHandle colKey="qa" onResize={resizeFCol} /></th>
                </tr>
              </thead>
              <tbody>
                {features.map(f => {
                  const stColor = STATUS_COLORS[f.status] || '#9ca3af';
                  const pr = PRIORITY_STYLE[f.priority];
                  return (
                    <tr key={f.id} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => navigate('/releases/' + selectedReleaseId + '/feature/' + f.id)}>
                      <td className="px-3 py-2"><span className="text-xs font-mono font-semibold" style={{ color: '#1a56b0' }}>{rfeId(f.id)}</span></td>
                      <td className="px-3 py-2 font-medium text-gray-800">{f.name}</td>
                      <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: stColor + '22', color: stColor }}>{STATUS_LABELS[f.status] || f.status}</span></td>
                      <td className="px-3 py-2">{pr ? <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: pr.bg, color: pr.color }}>{f.priority}</span> : <span className="text-xs text-gray-300">&mdash;</span>}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{f.dev_assignee || <span className="text-gray-300">&mdash;</span>}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{f.qa_assignee || <span className="text-gray-300">&mdash;</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test Runs Section */}
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
        <h2 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#0e2e5b' }}>
          <Play size={12} className="inline mr-1.5" />Test Runs ({testRuns.length})
        </h2>
        {testRuns.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No test runs yet. Create test runs in the Test Runs tab.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: '#e8f0fe' }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.id }}>ID<ColHandle colKey="id" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.name }}>Name<ColHandle colKey="name" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.type }}>Type<ColHandle colKey="type" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.total }}>Total<ColHandle colKey="total" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.progress }}>Progress<ColHandle colKey="progress" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.pass }}>Pass<ColHandle colKey="pass" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.fail }}>Fail<ColHandle colKey="fail" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.blocked }}>Blocked<ColHandle colKey="blocked" onResize={resizeTrCol} /></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase relative" style={{ width: trCols.pending }}>Pending<ColHandle colKey="pending" onResize={resizeTrCol} /></th>
                </tr>
              </thead>
              <tbody>
                {testRuns.map(tr => {
                  const pct = tr.total > 0 ? Math.round(((tr.pass + tr.fail + tr.blocked) / tr.total) * 100) : 0;
                  const trUrl = tr.source === 'feature'
                    ? '/runs/release/' + selectedReleaseId + '/feature/' + tr.id
                    : '/runs/release/' + selectedReleaseId + '/tr/' + tr.id;
                  return (
                    <tr key={tr.source + '-' + tr.id} className="border-b border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => navigate(trUrl)}>
                      <td className="px-3 py-2"><span className="text-xs font-mono font-semibold" style={{ color: '#1a56b0' }}>{runId(tr.source, tr.id)}</span></td>
                      <td className="px-3 py-2 font-medium text-gray-800">{tr.name}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={tr.source === 'feature' ? { background: '#cffafe', color: '#0e7490' } : { background: '#e8f0fe', color: '#1a56b0' }}>
                          {tr.source === 'feature' ? 'Feature' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{tr.total}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-2 w-20 rounded-full overflow-hidden bg-gray-200">
                            {tr.pass > 0 && <div style={{ width: (tr.pass / (tr.total || 1) * 100) + '%', background: '#22c55e' }} />}
                            {tr.fail > 0 && <div style={{ width: (tr.fail / (tr.total || 1) * 100) + '%', background: '#ef4444' }} />}
                            {tr.blocked > 0 && <div style={{ width: (tr.blocked / (tr.total || 1) * 100) + '%', background: '#f59e0b' }} />}
                          </div>
                          <span className="text-xs text-gray-500">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className="text-xs font-medium text-green-600">{tr.pass}</span></td>
                      <td className="px-3 py-2"><span className="text-xs font-medium text-red-600">{tr.fail}</span></td>
                      <td className="px-3 py-2"><span className="text-xs font-medium text-orange-500">{tr.blocked}</span></td>
                      <td className="px-3 py-2"><span className="text-xs text-gray-400">{tr.pending}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Bugs Section (placeholder) */}
      <div className="px-6 py-4 shrink-0">
        <h2 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#0e2e5b' }}>
          <Bug size={12} className="inline mr-1.5" />Open Bugs
        </h2>
        <div className="rounded-lg p-6 text-center" style={{ background: '#fef2f2', border: '1px dashed #fca5a5' }}>
          <AlertTriangle size={24} className="text-red-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Bug tracking integration coming soon</p>
          <p className="text-xs text-gray-400 mt-1">This section will be populated after integration with Bugsby</p>
        </div>
      </div>
    </div>
  );
}
