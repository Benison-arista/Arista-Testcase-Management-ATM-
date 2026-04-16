import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Upload } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import FolderTree from '../folder/FolderTree';
import TCList from '../testcase/TCList';
import TCDetail from '../testcase/TCDetail';
import TCForm from '../testcase/TCForm';
import ExcelImport from '../import/ExcelImport';
import useAppStore from '../../stores/useAppStore';
import useSearchStore from '../../stores/useSearchStore';
import useTCStore from '../../stores/useTCStore';
import useFolderStore from '../../stores/useFolderStore';

const STORAGE_KEY = 'atm_pane_widths';
const DEFAULT_SIDEBAR = 224;
const DEFAULT_LIST = 288;
const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 400;
const MIN_LIST = 200;
const MAX_LIST = 500;

function loadWidths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sidebar: DEFAULT_SIDEBAR, list: DEFAULT_LIST };
}

function saveWidths(w) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
}

function ResizeHandle({ onResize }) {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    let lastX = e.clientX;

    const handleMouseMove = (e) => {
      const delta = e.clientX - lastX;
      lastX = e.clientX;
      if (delta !== 0) onResize(delta);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 hover:w-1.5 cursor-col-resize shrink-0 transition-colors"
      style={{ background: '#d0def4' }}
      onMouseEnter={e => e.currentTarget.style.background = '#3d8bfd'}
      onMouseLeave={e => e.currentTarget.style.background = '#d0def4'}
    />
  );
}

export default function TCSection({ section }) {
  const canEdit = useAppStore(s => s.isEditor());
  const { mode } = useSearchStore();
  const { selectedTC, list, fetchList, clearList, moveTC } = useTCStore();
  const { selectedFolderId, moveFolder } = useFolderStore();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);

  const [paneWidths, setPaneWidths] = useState(loadWidths);
  const saveTimer = useRef(null);

  const handleSidebarResize = useCallback((delta) => {
    setPaneWidths(prev => {
      const newWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, prev.sidebar + delta));
      const updated = { ...prev, sidebar: newWidth };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveWidths(updated), 200);
      return updated;
    });
  }, []);

  const handleListResize = useCallback((delta) => {
    setPaneWidths(prev => {
      const newWidth = Math.min(MAX_LIST, Math.max(MIN_LIST, prev.list + delta));
      const updated = { ...prev, list: newWidth };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveWidths(updated), 200);
      return updated;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => { clearList(); }, [section]);

  const showList = mode !== 'idle' || selectedFolderId !== null || list.length > 0;

  const handleImportClose = () => {
    setShowImport(false);
    fetchList({ section, ...(selectedFolderId ? { folder_id: selectedFolderId } : {}) });
  };

  const handleDragStart = (event) => {
    setActiveDrag(event.active.data.current);
  };

  const handleDragEnd = async (event) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current;
    const dropData = over.data.current;

    let targetFolderId = null;
    if (dropData?.type === 'folder') {
      targetFolderId = dropData.id;
    } else if (dropData?.type === 'folder-root') {
      targetFolderId = null;
    } else {
      return;
    }

    try {
      if (dragData.type === 'tc') {
        await moveTC(dragData.id, targetFolderId);
      } else if (dragData.type === 'folder') {
        if (dragData.id === targetFolderId) return;
        await moveFolder(dragData.id, targetFolderId, section);
      }
    } catch (err) {
      console.error('Move failed:', err);
      alert(err.response?.data?.error || 'Move failed');
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex flex-col shrink-0 overflow-hidden" style={{ width: paneWidths.sidebar, background: '#f0f5fc' }}>
          <FolderTree section={section} />
        </aside>

        <ResizeHandle onResize={handleSidebarResize} />

        {/* List panel */}
        <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: paneWidths.list }}>
          <div className="flex items-center justify-between px-3 py-2 border-b bg-white" style={{ borderColor: '#d0def4' }}>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0e2e5b' }}>
              {mode !== 'idle' ? 'Search Results' : 'Test Cases'}
            </span>
            {canEdit && (
              <div className="flex gap-1">
                <button onClick={() => setShowImport(true)} title="Import Excel" className="p-1 hover:bg-gray-100 rounded">
                  <Upload size={13} className="text-gray-500" />
                </button>
                <button onClick={() => setShowForm(true)} title="New TC" className="p-1 hover:bg-gray-100 rounded">
                  <Plus size={13} className="text-gray-500" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {showList
              ? <TCList section={section} />
              : <p className="text-xs text-gray-400 text-center px-3 py-8">Select a folder to view test cases.</p>
            }
          </div>
        </div>

        <ResizeHandle onResize={handleListResize} />

        {/* Detail panel */}
        <main className="flex-1 overflow-hidden flex flex-col bg-white min-w-0">
          <TCDetail section={section} />
        </main>

        {showForm && <TCForm section={section} onClose={() => setShowForm(false)} />}
        {showImport && <ExcelImport section={section} onClose={handleImportClose} />}
      </div>

      <DragOverlay>
        {activeDrag && (
          <div className="bg-white border border-arista-300 shadow-lg rounded-lg px-3 py-2 text-sm text-gray-700 max-w-[200px] truncate">
            {activeDrag.type === 'tc' ? `TC: ${activeDrag.title}` : `Folder: ${activeDrag.name}`}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
