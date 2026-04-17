import { useNavigate } from 'react-router-dom';
import { Tag, Play, Bug, AlertTriangle } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';

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

function DonutChart({ segments, total, size = 130, label }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
        <text x="65" y="60" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 20, fontWeight: 700, fill: '#9ca3af' }}>0</text>
        <text x="65" y="78" textAnchor="middle" style={{ fontSize: 10, fill: '#9ca3af' }}>{label}</text>
      </svg>
    );
  }
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 130 130">
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const dashOff = -offset;
        offset += dash;
        return <circle key={i} cx="65" cy="65" r={radius} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={dashOff} transform="rotate(-90 65 65)" />;
      })}
      <text x="65" y="60" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 22, fontWeight: 700, fill: '#0e2e5b' }}>{total}</text>
      <text x="65" y="78" textAnchor="middle" style={{ fontSize: 10, fill: '#6b7280' }}>{label}</text>
    </svg>
  );
}

function rfeId(id) { return 'RFE-' + String(id).padStart(4, '0'); }
function runId(source, id) { return source === 'feature' ? 'TR-F' + String(id).padStart(4, '0') : 'TR-' + String(id).padStart(4, '0'); }

export default function ReleaseDashboard() {
  const navigate = useNavigate();
  const { selectedReleaseId, features, summary, testRuns, tree } = useReleaseStore();

  // Find release node
  function findRelease(nodes) {
    for (const n of nodes) {
      if (n.id === selectedReleaseId) return n;
      const found = findRelease(n.children || []);
      if (found) return found;
    }
    return null;
  }
  const release = findRelease(tree);

  // Feature status segments for donut
  const featureSegments = Object.entries(STATUS_COLORS).map(([status, color]) => ({
    value: features.filter(f => f.status === status).length,
    color,
    label: STATUS_LABELS[status],
  }));
  const featureTotal = features.length;

  // Test run aggregate stats
  const totalTCs = testRuns.reduce((s, t) => s + (t.total || 0), 0);
  const totalPass = testRuns.reduce((s, t) => s + (t.pass || 0), 0);
  const totalFail = testRuns.reduce((s, t) => s + (t.fail || 0), 0);
  const totalBlocked = testRuns.reduce((s, t) => s + (t.blocked || 0), 0);
  const totalPending = testRuns.reduce((s, t) => s + (t.pending || 0), 0);
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

      {/* Graphical Overview */}
      <div className="px-6 py-5 shrink-0" style={{ borderBottom: '1px solid #d0def4' }}>
        <h2 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: '#0e2e5b' }}>Overview</h2>
        <div className="flex items-start gap-8 flex-wrap">
          {/* Feature status donut */}
          <div className="flex flex-col items-center">
            <DonutChart segments={featureSegments} total={featureTotal} label="Features" />
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 justify-center">
              {featureSegments.filter(s => s.value > 0).map(s => (
                <div key={s.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-[10px] text-gray-500">{s.label}: {s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Test execution donut */}
          <div className="flex flex-col items-center">
            <DonutChart segments={runSegments} total={totalTCs} label="Test Cases" />
            <div className="flex gap-3 mt-3">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} /><span className="text-[10px] text-gray-500">Pass: {totalPass}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} /><span className="text-[10px] text-gray-500">Fail: {totalFail}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /><span className="text-[10px] text-gray-500">Blocked: {totalBlocked}</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#d1d5db' }} /><span className="text-[10px] text-gray-500">Pending: {totalPending}</span></div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 min-w-[280px]">
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0f5fc' }}>
              <p className="text-2xl font-bold" style={{ color: '#0e2e5b' }}>{featureTotal}</p>
              <p className="text-xs text-gray-500">Features</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0f5fc' }}>
              <p className="text-2xl font-bold" style={{ color: '#0e2e5b' }}>{testRuns.length}</p>
              <p className="text-xs text-gray-500">Test Runs</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: '#f0f5fc' }}>
              <p className="text-2xl font-bold" style={{ color: '#0e2e5b' }}>{totalTCs}</p>
              <p className="text-xs text-gray-500">Total TCs</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: totalTCs > 0 ? '#f0fdf4' : '#f0f5fc' }}>
              <p className="text-2xl font-bold" style={{ color: totalTCs > 0 ? '#22c55e' : '#0e2e5b' }}>{totalTCs > 0 ? Math.round((totalPass / totalTCs) * 100) : 0}%</p>
              <p className="text-xs text-gray-500">Pass Rate</p>
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
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#e8f0fe' }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Feature</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Dev</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">QA</th>
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
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#e8f0fe' }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Progress</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Pass</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Fail</th>
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
                          <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-gray-200">
                            {tr.pass > 0 && <div style={{ width: (tr.pass / (tr.total || 1) * 100) + '%', background: '#22c55e' }} />}
                            {tr.fail > 0 && <div style={{ width: (tr.fail / (tr.total || 1) * 100) + '%', background: '#ef4444' }} />}
                            {tr.blocked > 0 && <div style={{ width: (tr.blocked / (tr.total || 1) * 100) + '%', background: '#f59e0b' }} />}
                          </div>
                          <span className="text-xs text-gray-500">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className="text-xs font-medium text-green-600">{tr.pass}</span></td>
                      <td className="px-3 py-2"><span className="text-xs font-medium text-red-600">{tr.fail}</span></td>
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
