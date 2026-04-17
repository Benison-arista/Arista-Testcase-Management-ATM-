import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2, X, Play, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import useReleaseStore from '../../stores/useReleaseStore';
import useAppStore from '../../stores/useAppStore';
import FeatureForm from './FeatureForm';
import { getReleaseRunSummary, getRunsByRelease } from '../../api/runs';

const STATUS_STYLE = {
  requested:    { bg: '#f3f4f6', color: '#374151', label: 'Requested' },
  committed:    { bg: '#dbeafe', color: '#1e40af', label: 'Committed' },
  in_progress:  { bg: '#fef3c7', color: '#92400e', label: 'In Progress' },
  dev_complete: { bg: '#e9d5ff', color: '#6b21a8', label: 'Dev Complete' },
  in_testing:   { bg: '#cffafe', color: '#0e7490', label: 'In Testing' },
  completed:    { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
  deferred:     { bg: '#fee2e2', color: '#991b1b', label: 'Deferred' },
};

const PRIORITY_STYLE = {
  P0: { bg: '#fee2e2', color: '#991b1b' },
  P1: { bg: '#ffedd5', color: '#9a3412' },
  P2: { bg: '#fef9c3', color: '#854d0e' },
  P3: { bg: '#f3f4f6', color: '#374151' },
};

const GRID_FIELDS = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'jira_id', label: 'Jira ID' },
  { key: 'dev_assignee', label: 'Dev Assignee' },
  { key: 'qa_assignee', label: 'QA Assignee' },
  { key: 'pm', label: 'PM' },
  { key: 'target_date', label: 'Target Date' },
  { key: 'dev_eta', label: 'Dev ETA' },
  { key: 'qa_eta', label: 'QA ETA' },
  { key: 'tags', label: 'Tags' },
  { key: 'created_by', label: 'Created By' },
  { key: 'created_at', label: 'Created' },
];

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString();
}

const RUN_STATUS_COLORS = { pass: '#22c55e', fail: '#ef4444', blocked: '#f59e0b', pending: '#d1d5db' };
const STATUS_ICONS = {
  pass: <CheckCircle size={14} className="text-green-500" />,
  fail: <XCircle size={14} className="text-red-500" />,
  blocked: <AlertCircle size={14} className="text-orange-500" />,
  pending: <Clock size={14} className="text-gray-400" />,
};

export default function FeatureDetail() {
  const navigate = useNavigate();
  const { selectedFeature, selectedReleaseId, deleteFeature, clearFeature } = useReleaseStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [editing, setEditing] = useState(false);
  const [runSummary, setRunSummary] = useState(null);
  const [runItems, setRunItems] = useState([]);
  const [runPage, setRunPage] = useState(1);
  const [runTotal, setRunTotal] = useState(0);
  const [runTotalPages, setRunTotalPages] = useState(0);
  const runLimit = 20;

  const featureId = selectedFeature?.id;

  useEffect(() => {
    if (!featureId || !selectedReleaseId) return;
    let cancelled = false;
    (async () => {
      try {
        const [summary, res] = await Promise.all([
          getReleaseRunSummary({ release_id: selectedReleaseId, feature_id: featureId }),
          getRunsByRelease({ release_id: selectedReleaseId, feature_id: featureId, page: 1, limit: runLimit }),
        ]);
        if (cancelled) return;
        setRunSummary(summary);
        setRunItems(res.data || []);
        setRunTotal(res.pagination?.total || 0);
        setRunTotalPages(res.pagination?.totalPages || 0);
        setRunPage(1);
      } catch (err) {
        if (!cancelled) console.error('Failed to fetch feature test runs:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [featureId, selectedReleaseId]);

  const fetchRunPage = async (page) => {
    try {
      const res = await getRunsByRelease({ release_id: selectedReleaseId, feature_id: featureId, page, limit: runLimit });
      setRunItems(res.data || []);
      setRunTotal(res.pagination?.total || 0);
      setRunTotalPages(res.pagination?.totalPages || 0);
      setRunPage(res.pagination?.page || 1);
    } catch (err) {
      console.error('Failed to fetch feature test runs:', err);
    }
  };

  if (!selectedFeature) return null;

  const f = selectedFeature;
  const st = STATUS_STYLE[f.status] || STATUS_STYLE.requested;

  const handleDelete = async () => {
    if (!confirm('Delete feature "' + f.name + '"?')) return;
    await deleteFeature(f.id);
    navigate('/releases/' + selectedReleaseId);
  };

  const handleClose = () => {
    clearFeature();
    navigate('/releases/' + selectedReleaseId);
  };

  const getValue = (key) => {
    const val = f[key];
    if (val === null || val === undefined || val === '') return null;
    if (key === 'created_at' || key === 'target_date' || key === 'dev_eta' || key === 'qa_eta') return formatDate(val);
    if (key === 'status') {
      const s = STATUS_STYLE[val] || {};
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label || val}</span>;
    }
    if (key === 'priority' && PRIORITY_STYLE[val]) {
      const p = PRIORITY_STYLE[val];
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: p.bg, color: p.color }}>{val}</span>;
    }
    return String(val);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '2px solid #d0def4' }}>
        <div className="min-w-0 flex-1 mr-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0" style={{ background: '#e8f0fe', color: '#1a56b0' }}>RFE-{String(f.id).padStart(4, '0')}</span>
            <h2 style={{ color: '#0e2e5b' }} className="font-bold text-lg leading-tight truncate">{f.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Created by {f.created_by} &middot; {formatDate(f.created_at)}
            {f.updated_at && ' \u00b7 Updated ' + formatDate(f.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <>
              <button onClick={() => setEditing(true)} style={{ color: '#1a56b0', borderColor: '#a1bde9' }} className="flex items-center gap-1 text-xs font-medium hover:opacity-80 border rounded px-2 py-1">
                <Edit2 size={13} /> Edit
              </button>
              <button onClick={handleDelete} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1">
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
          {GRID_FIELDS.map(({ key, label }) => {
            const val = getValue(key);
            if (val === null) return null;
            return (
              <div key={key}>
                <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#1a56b0' }}>{label}</p>
                <div className="text-sm text-gray-800">{val}</div>
              </div>
            );
          })}
        </div>

        {/* Description */}
        {f.description && (
          <div className="pt-4" style={{ borderTop: '1px solid #d0def4' }}>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0e2e5b' }}>Description</h4>
            <div className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg p-4 leading-relaxed" style={{ background: '#f0f5fc' }}>
              {f.description}
            </div>
          </div>
        )}

        {/* Notes */}
        {f.notes && (
          <div className="pt-4" style={{ borderTop: '1px solid #d0def4' }}>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0e2e5b' }}>Notes</h4>
            <div className="text-sm text-gray-800 whitespace-pre-wrap rounded-lg p-4 leading-relaxed" style={{ background: '#f0f5fc' }}>
              {f.notes}
            </div>
          </div>
        )}

        {/* Test Runs */}
        <div className="pt-4" style={{ borderTop: '1px solid #d0def4' }}>
          <h4 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#0e2e5b' }}>
            <Play size={12} className="inline mr-1.5" />Test Runs ({runTotal})
          </h4>

          {runSummary && runSummary.total > 0 && (() => {
            const executed = (runSummary.pass || 0) + (runSummary.fail || 0) + (runSummary.blocked || 0);
            const execPct = runSummary.total > 0 ? Math.round((executed / runSummary.total) * 100) : 0;
            const passPct = runSummary.total > 0 ? Math.round(((runSummary.pass || 0) / runSummary.total) * 100) : 0;
            return (
              <div className="mb-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.pass }} /><span className="text-xs text-gray-600">Pass: <strong>{runSummary.pass}</strong></span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.fail }} /><span className="text-xs text-gray-600">Fail: <strong>{runSummary.fail}</strong></span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.blocked }} /><span className="text-xs text-gray-600">Blocked: <strong>{runSummary.blocked}</strong></span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: RUN_STATUS_COLORS.pending }} /><span className="text-xs text-gray-600">Pending: <strong>{runSummary.pending}</strong></span></div>
                  <span className="text-xs text-gray-400 ml-auto">{execPct}% executed &middot; {passPct}% pass rate</span>
                </div>
                <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-200">
                  {runSummary.pass > 0 && <div style={{ width: (runSummary.pass / runSummary.total * 100) + '%', background: RUN_STATUS_COLORS.pass }} />}
                  {runSummary.fail > 0 && <div style={{ width: (runSummary.fail / runSummary.total * 100) + '%', background: RUN_STATUS_COLORS.fail }} />}
                  {runSummary.blocked > 0 && <div style={{ width: (runSummary.blocked / runSummary.total * 100) + '%', background: RUN_STATUS_COLORS.blocked }} />}
                </div>
              </div>
            );
          })()}

          {runItems.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No test cases linked to this feature yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr style={{ background: '#e8f0fe' }}>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase" style={{ width: 80 }}>ID</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Title</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase" style={{ width: 80 }}>Section</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase" style={{ width: 90 }}>Status</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase" style={{ width: 80 }}>Version</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase" style={{ width: 100 }}>Bugs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runItems.map(item => {
                      const title = item.data?.title || item.data?.Title || 'Untitled';
                      return (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/runs/release/' + selectedReleaseId + '/feature/' + f.id)}>
                          <td className="px-3 py-2"><span className="text-xs font-mono font-semibold" style={{ color: '#1a56b0' }}>TC-{String(item.testcase_id).padStart(4, '0')}</span></td>
                          <td className="px-3 py-2 text-gray-800 truncate max-w-xs">{title}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 capitalize">{item.section || '\u2014'}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1">
                              {STATUS_ICONS[item.status]}
                              <span className="text-xs font-medium capitalize">{item.status}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{item.version || '\u2014'}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{item.bugs || '\u2014'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {runTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">Page {runPage} of {runTotalPages} ({runTotal} test cases)</span>
                  <div className="flex gap-1">
                    <button disabled={runPage <= 1} onClick={() => fetchRunPage(runPage - 1)} className="text-xs px-2 py-1 rounded border disabled:opacity-30" style={{ borderColor: '#d0def4', color: '#1a56b0' }}>Prev</button>
                    <button disabled={runPage >= runTotalPages} onClick={() => fetchRunPage(runPage + 1)} className="text-xs px-2 py-1 rounded border disabled:opacity-30" style={{ borderColor: '#d0def4', color: '#1a56b0' }}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editing && <FeatureForm initial={f} onClose={() => setEditing(false)} />}
    </div>
  );
}
