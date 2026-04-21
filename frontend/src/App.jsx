import { Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from './stores/useAppStore';
import UserPrompt from './components/layout/UserPrompt';
import TopBar from './components/layout/TopBar';
import HomeSection from './components/layout/HomeSection';
import TCSection from './components/layout/TCSection';
import RunsSection from './components/layout/RunsSection';
import ReleasesSection from './components/releases/ReleasesSection';

export default function App() {
  const { user } = useAppStore();

  if (!user) return <UserPrompt />;

  return (
    <div className="flex flex-col h-screen" style={{ background: '#f5f8fc' }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Routes>
          <Route path="/home" element={<HomeSection />} />
          <Route path="/sd-wan" element={<TCSection section="velocloud" />} />
          <Route path="/sd-wan/folder/:folderId" element={<TCSection section="velocloud" />} />
          <Route path="/sd-wan/folder/:folderId/tc/:tcId" element={<TCSection section="velocloud" />} />
          <Route path="/arista" element={<TCSection section="arista" />} />
          <Route path="/arista/folder/:folderId" element={<TCSection section="arista" />} />
          <Route path="/arista/folder/:folderId/tc/:tcId" element={<TCSection section="arista" />} />
          <Route path="/runs" element={<RunsSection />} />
          <Route path="/runs/release/:releaseId" element={<RunsSection />} />
          <Route path="/runs/release/:releaseId/tr/:runId" element={<RunsSection />} />
          <Route path="/runs/release/:releaseId/tr/:runId/item/:itemId" element={<RunsSection />} />
          <Route path="/runs/release/:releaseId/feature/:featureId" element={<RunsSection />} />
          <Route path="/runs/release/:releaseId/feature/:featureId/item/:itemId" element={<RunsSection />} />
          <Route path="/releases" element={<ReleasesSection />} />
          <Route path="/releases/:releaseId" element={<ReleasesSection />} />
          <Route path="/releases/:releaseId/feature/:featureId" element={<ReleasesSection />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
    </div>
  );
}
