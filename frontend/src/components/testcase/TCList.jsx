import { FileText, Loader, GripVertical, Folder, ChevronRight, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import useTCStore from '../../stores/useTCStore';
import useSearchStore from '../../stores/useSearchStore';
import useFolderStore from '../../stores/useFolderStore';
import useAppStore from '../../stores/useAppStore';
import { getIdKey } from '../../schemas';
import Pagination from '../common/Pagination';

function badge(priority) {
  const colors = { P1: 'bg-red-100 text-red-700', P2: 'bg-orange-100 text-orange-700', P3: 'bg-green-100 text-green-700' };
  return colors[priority] || 'bg-gray-100 text-gray-600';
}

function SubFolderItem({ folder, section }) {
  const navigate = useNavigate();
  const { selectFolder } = useFolderStore();
  const { fetchList } = useTCStore();
  const { mode, clearSearch } = useSearchStore();

  const handleClick = () => {
    if (mode !== 'idle') {
      clearSearch();
      const searchInput = document.querySelector('header input[placeholder*="Search"]');
      if (searchInput) searchInput.value = '';
    }
    navigate('/' + section + '/folder/' + folder.id);
    selectFolder(folder.id);
    fetchList({ folder_id: folder.id, section });
  };

  return (
    <div
      onClick={handleClick}
      className="px-4 py-2.5 cursor-pointer hover:bg-amber-50 transition-colors flex items-center gap-2 bg-gray-50"
    >
      <Folder size={14} className="text-amber-500 shrink-0" />
      <span className="text-sm font-medium text-gray-700 flex-1 truncate">{folder.name}</span>
      <ChevronRight size={14} className="text-gray-400 shrink-0" />
    </div>
  );
}

function DraggableTCItem({ tc, idKey, isActive, onSelect, isSearchResult, section }) {
  const navigate = useNavigate();
  const canEdit = useAppStore(s => s.isEditor());
  const { selectFolder, selectedFolderId } = useFolderStore();
  const { fetchList } = useTCStore();
  const { clearSearch } = useSearchStore();
  const id = tc.data[idKey];
  const title = tc.data.title || tc.data.description || id;
  const priority = tc.data.priority;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tc-drag-${tc.id}`,
    data: { type: 'tc', id: tc.id, title },
    disabled: !canEdit,
  });

  const handleGoToFolder = (e) => {
    e.stopPropagation();
    if (!tc.folder_id) return;
    clearSearch();
    const searchInput = document.querySelector('header input[placeholder*="Search"]');
    if (searchInput) searchInput.value = '';
    navigate('/' + section + '/folder/' + tc.folder_id);
    selectFolder(tc.folder_id);
    fetchList({ folder_id: tc.folder_id, section });
  };

  const handleClick = () => {
    onSelect(tc);
    const fid = tc.folder_id || selectedFolderId;
    if (fid) {
      navigate('/' + section + '/folder/' + fid + '/tc/' + tc.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`px-4 py-3 cursor-pointer transition-colors ${isDragging ? 'opacity-40' : ''}`}
      style={isActive ? { background: '#dbeafe', borderLeft: '3px solid #1a56b0' } : {}}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#e0eaf7'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ''; }}
    >
      <div className="flex items-start justify-between gap-2">
        {canEdit && (
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
            <GripVertical size={12} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
          {id && <p className="text-xs text-gray-400 mt-0.5">{id}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {priority && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge(priority)}`}>
              {priority}
            </span>
          )}
          {isSearchResult && tc.folder_id && (
            <button
              onClick={handleGoToFolder}
              title="Open parent folder"
              style={{ color: '#1a56b0' }}
              className="p-0.5 rounded hover:bg-blue-100 transition-colors"
            >
              <FolderOpen size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TCList({ section }) {
  const { list, selectedTC, selectTC, loading, page, totalPages, total, setPage, fetchList } = useTCStore();
  const { results, mode } = useSearchStore();
  const { selectedFolderId, getChildren } = useFolderStore();
  const idKey = getIdKey(section);

  const items = mode !== 'idle' ? results : list;
  const subFolders = mode === 'idle' && selectedFolderId ? getChildren(selectedFolderId) : [];

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400">
      <Loader size={20} className="animate-spin mr-2" /> Loading...
    </div>
  );

  if (!items.length && !subFolders.length) return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
      <FileText size={32} strokeWidth={1} />
      <p className="text-sm">No test cases found.</p>
    </div>
  );

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchList({ folder_id: selectedFolderId, section, page: newPage });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {/* Sub-folders at the top */}
        {subFolders.map(folder => (
          <SubFolderItem key={folder.id} folder={folder} section={section} />
        ))}
        {/* TC items */}
        {items.map(tc => (
          <DraggableTCItem
            key={tc.id}
            tc={tc}
            idKey={idKey}
            isActive={selectedTC?.id === tc.id}
            onSelect={selectTC}
            isSearchResult={mode !== 'idle'}
            section={section}
          />
        ))}
      </div>
      {mode === 'idle' && (
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
