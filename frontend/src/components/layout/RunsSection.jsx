import RunFolderTree from '../testrun/RunFolderTree';
import RunItemList from '../testrun/RunItemList';

export default function RunsSection() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-56 border-r border-gray-200 flex flex-col bg-gray-50 shrink-0">
        <RunFolderTree />
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col bg-white">
        <RunItemList />
      </main>
    </div>
  );
}
