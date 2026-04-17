import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReleaseTree from './ReleaseTree';
import FeatureList from './FeatureList';
import FeatureDetail from './FeatureDetail';
import useReleaseStore from '../../stores/useReleaseStore';

export default function ReleasesSection() {
  const { releaseId: urlReleaseId, featureId: urlFeatureId } = useParams();
  const { selectedReleaseId, selectRelease, selectedFeature, fetchFeature } = useReleaseStore();

  // Sync URL params to state
  useEffect(() => {
    const rid = urlReleaseId ? parseInt(urlReleaseId, 10) : null;
    const fid = urlFeatureId ? parseInt(urlFeatureId, 10) : null;

    if (rid && rid !== selectedReleaseId) {
      selectRelease(rid).then(() => {
        if (fid) fetchFeature(rid, fid);
      });
    } else if (rid && fid && (!selectedFeature || selectedFeature.id !== fid)) {
      fetchFeature(rid, fid);
    }
  }, [urlReleaseId, urlFeatureId]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 overflow-hidden" style={{ background: '#f0f5fc' }}>
        <ReleaseTree />
      </aside>

      {/* Main area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-white min-w-0">
        {selectedFeature ? (
          <FeatureDetail />
        ) : (
          <FeatureList />
        )}
      </main>
    </div>
  );
}
