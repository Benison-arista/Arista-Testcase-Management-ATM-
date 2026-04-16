import { useState, useEffect } from 'react';
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

export default function TCSection({ section }) {
  const canEdit = useAppStore(s => s.isEditor());
  const { mode } = useSearchStore();
  const { selectedTC, list, fetchList, clearList, moveTC } = useTCStore();
  const { selectedFolderId, moveFolder } = useFolderStore();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);

  // Require 8px of movement before starting drag (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Clear stale list whenever the section tab changes
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

    // Determine target folder ID from the drop zone
    let targetFolderId = null;
    if (dropData?.type === 'folder') {
      targetFolderId = dropData.id;
    } else if (dropData?.type === 'folder-root') {
      targetFolderId = null; // move to root
    } else {
      return; // dropped on something that isn't a folder
    }

    try {
      if (dragData.type === 'tc') {
        // Moving a test case to a folder
        await moveTC(dragData.id, targetFolderId);
      } else if (dragData.type === 'folder') {
        // Moving a folder into another folder (or root)
        if (dragData.id === targetFolderId) return; // can't drop on self
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
        <aside className="w-56 border-r border-gray-200 flex flex-col bg-gray-50 shrink-0">
          <FolderTree section={section} />
        </aside>

        {/* List panel */}
        <div className="w-72 border-r border-gray-200 flex flex-col shrink-0">
          {/* List toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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

        {/* Detail panel */}
        <main className="flex-1 overflow-hidden flex flex-col bg-white">
          <TCDetail section={section} />
        </main>

        {showForm && <TCForm section={section} onClose={() => setShowForm(false)} />}
        {showImport && <ExcelImport section={section} onClose={handleImportClose} />}
      </div>

      {/* Drag overlay — floating label that follows the cursor */}
      <DragOverlay>
        {activeDrag && (
          <div className="bg-white border border-blue-300 shadow-lg rounded-lg px-3 py-2 text-sm text-gray-700 max-w-[200px] truncate">
            {activeDrag.type === 'tc' ? `TC: ${activeDrag.title}` : `Folder: ${activeDrag.name}`}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
