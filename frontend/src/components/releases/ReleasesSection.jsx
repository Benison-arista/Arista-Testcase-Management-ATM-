import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReleaseTree from './ReleaseTree';
import ReleaseDashboard from './ReleaseDashboard';
import FeatureList from './FeatureList';
import FeatureDetail from './FeatureDetail';
import useReleaseStore from '../../stores/useReleaseStore';

export default function ReleasesSection() {
  const { releaseId: urlReleaseId, featureId: urlFeatureId } = useParams();
  const { selectedReleaseId, selectRelease, selectedFeature, fetchFeature } = useReleaseStore();

  const { clearFeature } = useReleaseStore();

  // Sync URL params to state
  useEffect(() => {
    const rid = urlReleaseId ? parseInt(urlReleaseId, 10) : null;
    const fid = urlFeatureId ? parseInt(urlFeatureId, 10) : null;

    if (rid && fid) {
      // Feature URL — load it
      if (!selectedFeature || selectedFeature.id !== fid) {
        if (rid !== selectedReleaseId) selectRelease(rid).then(() => fetchFeature(rid, fid));
        else fetchFeature(rid, fid);
      }
    } else if (rid) {
      // Release URL (no feature) — clear any selected feature, load release
      if (selectedFeature) clearFeature();
      if (rid !== selectedReleaseId) selectRelease(rid);
    } else {
      // No release selected — clear everything
      if (selectedFeature) clearFeature();
    }
  }, [urlReleaseId, urlFeatureId]);

  // Determine what to show in the main panel
  let mainContent;
  if (selectedFeature) {
    mainContent = <FeatureDetail />;
  } else if (selectedReleaseId && !urlFeatureId) {
    mainContent = <ReleaseDashboard />;
  } else {
    mainContent = <FeatureList />;
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 overflow-hidden" style={{ background: '#f0f5fc' }}>
        <ReleaseTree />
      </aside>

      {/* Main area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-white min-w-0">
        {mainContent}
      </main>
    </div>
  );
}
