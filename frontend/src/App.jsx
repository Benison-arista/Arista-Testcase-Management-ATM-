import useAppStore from './stores/useAppStore';
import UserPrompt from './components/layout/UserPrompt';
import TopBar from './components/layout/TopBar';
import TCSection from './components/layout/TCSection';
import RunsSection from './components/layout/RunsSection';

export default function App() {
  const { user, activeTab } = useAppStore();

  if (!user) return <UserPrompt />;

  return (
    <div className="flex flex-col h-screen" style={{ background: '#f5f8fc' }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'velocloud' && <TCSection section="velocloud" />}
        {activeTab === 'arista'    && <TCSection section="arista" />}
        {activeTab === 'runs'      && <RunsSection />}
      </div>
    </div>
  );
}
