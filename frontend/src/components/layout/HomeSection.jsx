import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, FileText, ArrowRight, Layers, TrendingUp } from 'lucide-react';
import atmLogo from '../../assets/atm-logo.png';
import { getTestcaseCounts } from '../../api/testcases';
import { getReleasesOverview } from '../../api/releases';

/* ── colour constants ── */
const RUN_STATUS_COLORS = { pass: '#22c55e', fail: '#ef4444', blocked: '#f59e0b', pending: '#d1d5db' };

/* ── small reusable pieces ── */

function StatCard({ value, label, color, bg, size = 'md' }) {
  const textSize = size === 'lg' ? 'text-3xl' : 'text-2xl';
  const pad = size === 'lg' ? 'p-4' : 'p-3';
  return (
    <div className={`rounded-xl ${pad} text-center`} style={{ background: bg || '#f0f5fc' }}>
      <p className={`${textSize} font-bold`} style={{ color: color || '#0e2e5b' }}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function ProgressBar({ pass, fail, blocked, total, height = 'h-2' }) {
  if (total === 0) return <div className={`flex ${height} w-full rounded-full overflow-hidden bg-gray-200`} />;
  return (
    <div className={`flex ${height} w-full rounded-full overflow-hidden bg-gray-200`}>
      {pass > 0 && <div style={{ width: (pass / total * 100) + '%', background: RUN_STATUS_COLORS.pass }} />}
      {fail > 0 && <div style={{ width: (fail / total * 100) + '%', background: RUN_STATUS_COLORS.fail }} />}
      {blocked > 0 && <div style={{ width: (blocked / total * 100) + '%', background: RUN_STATUS_COLORS.blocked }} />}
    </div>
  );
}

function DonutChart({ segments, total, size = 160, centerText, subText }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
        <text x="80" y="74" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 22, fontWeight: 700, fill: '#9ca3af' }}>0</text>
        <text x="80" y="96" textAnchor="middle" style={{ fontSize: 10, fill: '#9ca3af' }}>{subText}</text>
      </svg>
    );
  }
  const visible = segments.filter(s => s.value > 0);
  const arcs = visible.reduce((acc, seg) => {
    const dash = (seg.value / total) * circumference;
    const prev = acc.length > 0 ? acc[acc.length - 1] : null;
    const dashOff = prev ? prev.dashOff - prev.dash : 0;
    acc.push({ dash, dashOff, color: seg.color });
    return acc;
  }, []);
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      {arcs.map((a, i) => (
        <circle key={i} cx="80" cy="80" r={radius} fill="none" stroke={a.color} strokeWidth="16" strokeDasharray={`${a.dash} ${circumference - a.dash}`} strokeDashoffset={a.dashOff} transform="rotate(-90 80 80)" />
      ))}
      <text x="80" y="72" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 24, fontWeight: 700, fill: '#0e2e5b' }}>{centerText}</text>
      <text x="80" y="96" textAnchor="middle" style={{ fontSize: 10, fill: '#6b7280' }}>{subText}</text>
    </svg>
  );
}

/* ── TC section card ── */

function TCSectionCard({ label, accent, counts, onClick }) {
  const tc = counts?.tc_count || 0;
  const folders = counts?.folder_count || 0;
  return (
    <div
      className="rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg group"
      style={{ background: 'white', border: '1px solid #d0def4' }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold" style={{ color: '#0e2e5b' }}>{label}</h3>
        <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
      </div>
      <div className="flex gap-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg p-2" style={{ background: accent + '15' }}>
            <FileText size={18} style={{ color: accent }} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: '#0e2e5b' }}>{tc.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Test Cases</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg p-2" style={{ background: accent + '15' }}>
            <FolderOpen size={18} style={{ color: accent }} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: '#0e2e5b' }}>{folders}</p>
            <p className="text-xs text-gray-500">Folders</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── main component ── */

export default function HomeSection() {
  const navigate = useNavigate();
  const [tcCounts, setTcCounts] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [counts, overview] = await Promise.all([
          getTestcaseCounts(),
          getReleasesOverview(),
        ]);
        if (cancelled) return;
        setTcCounts(counts);
        setReleases(overview);
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* aggregate release stats */
  const totalReleases = releases.length;
  const activeReleases = releases.filter(r => r.status === 'active').length;
  const totalFeatures = releases.reduce((s, r) => s + r.feature_count, 0);
  const totalFeaturesCompleted = releases.reduce((s, r) => s + r.features_completed, 0);
  const totalTCs = releases.reduce((s, r) => s + r.total_tcs, 0);
  const totalPass = releases.reduce((s, r) => s + r.pass_count, 0);
  const totalFail = releases.reduce((s, r) => s + r.fail_count, 0);
  const totalBlocked = releases.reduce((s, r) => s + r.blocked_count, 0);
  const totalExecuted = totalPass + totalFail + totalBlocked;
  const overallExecRate = totalTCs > 0 ? Math.round((totalExecuted / totalTCs) * 100) : 0;
  const overallPassRate = totalTCs > 0 ? Math.round((totalPass / totalTCs) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  const donutSegments = [
    { value: totalPass, color: RUN_STATUS_COLORS.pass },
    { value: totalFail, color: RUN_STATUS_COLORS.fail },
    { value: totalBlocked, color: RUN_STATUS_COLORS.blocked },
    { value: totalTCs - totalExecuted, color: RUN_STATUS_COLORS.pending },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Hero: logo + TC cards ── */}
      <div className="px-8 py-10" style={{ background: 'linear-gradient(180deg, #f8fafd 0%, #edf2fa 100%)', borderBottom: '2px solid #d0def4' }}>
        <div className="flex items-stretch gap-8 max-w-6xl mx-auto">
          {/* Logo */}
          <div className="shrink-0 flex items-center">
            <div className="rounded-2xl p-8 h-full flex items-center" style={{ background: 'white', boxShadow: '0 4px 24px rgba(14,46,91,0.10)' }}>
              <img src={atmLogo} alt="ATM - Arista Testcase Management" style={{ height: 200, width: 'auto' }} />
            </div>
          </div>

          {/* TC section cards — stacked vertically, fill remaining width */}
          <div className="flex-1 flex flex-col gap-4">
            <TCSectionCard
              label="SD-WAN"
              accent="#1a56b0"
              counts={tcCounts?.velocloud}
              onClick={() => navigate('/sd-wan')}
            />
            <TCSectionCard
              label="EOS"
              accent="#00b4d8"
              counts={tcCounts?.arista}
              onClick={() => navigate('/arista')}
            />
          </div>
        </div>
      </div>

      {/* ── Releases overview ── */}
      <div className="px-8 py-8 max-w-6xl mx-auto">
        {/* Section header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="rounded-lg p-2" style={{ background: '#e8f0fe' }}>
            <Layers size={18} style={{ color: '#1a56b0' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0e2e5b' }}>Releases Overview</h2>
            <p className="text-xs text-gray-400">{totalReleases} release{totalReleases !== 1 ? 's' : ''} &middot; {totalFeatures} features &middot; {totalTCs} test cases</p>
          </div>
        </div>

        {/* Aggregate dashboard in a card */}
        {totalReleases > 0 && (
          <div className="rounded-xl mb-8 overflow-hidden" style={{ border: '1px solid #d0def4', background: 'white' }}>
            <div className="flex items-start gap-8 p-6">
              {/* Donut chart */}
              <div className="shrink-0 flex flex-col items-center">
                <DonutChart
                  segments={donutSegments}
                  total={totalTCs}
                  centerText={overallPassRate + '%'}
                  subText="pass rate"
                />
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center max-w-[180px]">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.pass }} /><span className="text-[10px] text-gray-500">Pass: {totalPass}</span></div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.fail }} /><span className="text-[10px] text-gray-500">Fail: {totalFail}</span></div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.blocked }} /><span className="text-[10px] text-gray-500">Blocked: {totalBlocked}</span></div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: RUN_STATUS_COLORS.pending }} /><span className="text-[10px] text-gray-500">Pending: {totalTCs - totalExecuted}</span></div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="flex-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <StatCard value={totalReleases} label="Releases" size="lg" />
                  <StatCard value={activeReleases} label="Active" color="#3b82f6" bg="#eff6ff" size="lg" />
                  <StatCard value={totalFeatures} label="Features" size="lg" />
                  <StatCard value={totalFeaturesCompleted} label="Completed" color="#22c55e" bg="#f0fdf4" size="lg" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard value={totalTCs} label="Test Cases" />
                  <StatCard value={overallExecRate + '%'} label="Execution" color="#1a56b0" bg="#e8f0fe" />
                  <StatCard value={overallPassRate + '%'} label="Pass Rate" color={overallPassRate >= 80 ? '#22c55e' : overallPassRate >= 50 ? '#f59e0b' : '#ef4444'} bg={overallPassRate >= 80 ? '#f0fdf4' : overallPassRate >= 50 ? '#fffbeb' : '#fef2f2'} />
                  <StatCard value={totalFail} label="Failed" color="#ef4444" bg="#fef2f2" />
                </div>
              </div>
            </div>

            {/* Full-width progress bar at bottom of card */}
            {totalTCs > 0 && (
              <div className="px-6 pb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1"><TrendingUp size={11} />Overall Execution</span>
                  <span className="text-[11px] text-gray-400">{totalExecuted} of {totalTCs} executed</span>
                </div>
                <ProgressBar pass={totalPass} fail={totalFail} blocked={totalBlocked} total={totalTCs} height="h-2.5" />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
