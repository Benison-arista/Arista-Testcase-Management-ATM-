import { useState, useEffect } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, GripVertical } from 'lucide-react';
import useFolderStore from '../../stores/useFolderStore';
import useTCStore from '../../stores/useTCStore';
import useAppStore from '../../stores/useAppStore';

function FolderNode({ node, section, depth = 0 }) {
  const [open, setOpen] = useState(false);
  const { selectedFolderId, selectFolder, deleteFolder, createFolder } = useFolderStore();
  const { fetchList } = useTCStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const isSelected = selectedFolderId === node.id;

  // Droppable — this folder is a drop target for TCs and other folders
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `folder-drop-${node.id}`,
    data: { type: 'folder', id: node.id },
  });

  // Draggable — this folder can be dragged to another folder
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `folder-drag-${node.id}`,
    data: { type: 'folder', id: node.id, name: node.name },
    disabled: !canEdit,
  });

  const handleSelect = () => {
    selectFolder(node.id);
    fetchList({ folder_id: node.id, section });
    setOpen(true);
  };

  const handleAddChild = async (e) => {
    e.stopPropagation();
    if (!newName.trim()) return;
    await createFolder(newName.trim(), node.id, section);
    setNewName('');
    setAdding(false);
    setOpen(true);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete folder "${node.name}" and all its contents?`)) return;
    await deleteFolder(node.id, section);
    if (isSelected) { selectFolder(null); }
  };

  return (
    <div ref={setDropRef}>
      <div
        ref={setDragRef}
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer group select-none transition-colors ${
          isOver ? 'bg-blue-200 ring-2 ring-blue-400 ring-inset' :
          isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'
        } ${isDragging ? 'opacity-40' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleSelect}
      >
        {canEdit && (
          <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0" onClick={e => e.stopPropagation()}>
            <GripVertical size={12} />
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className="text-gray-400 hover:text-gray-600"
        >
          {node.children?.length > 0
            ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
            : <span className="w-3.5 inline-block" />}
        </button>

        {open ? <FolderOpen size={14} className="text-blue-500 shrink-0" />
               : <Folder size={14} className="text-blue-400 shrink-0" />}

        <span className="flex-1 text-sm truncate">{node.name}</span>

        {canEdit && (
          <span className="hidden group-hover:flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setAdding(a => !a); }} title="Add subfolder">
              <Plus size={13} className="text-gray-400 hover:text-blue-600" />
            </button>
            <button onClick={handleDelete} title="Delete folder">
              <Trash2 size={13} className="text-gray-400 hover:text-red-500" />
            </button>
          </span>
        )}
      </div>

      {open && (
        <div>
          {node.children?.map(child => (
            <FolderNode key={child.id} node={child} section={section} depth={depth + 1} />
          ))}
          {canEdit && adding && (
            <form
              onSubmit={handleAddChild}
              className="flex items-center gap-1 px-2 py-1"
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
              onClick={e => e.stopPropagation()}
            >
              <input
                autoFocus
                className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs"
                placeholder="Folder name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <button type="submit" className="text-xs text-blue-600 font-medium">Add</button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400">&times;</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ section }) {
  const { tree, fetchTree, createFolder } = useFolderStore();
  const canEdit = useAppStore(s => s.isEditor());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // Root-level drop target (move folder to top level)
  const { isOver: isOverRoot, setNodeRef: setRootDropRef } = useDroppable({
    id: 'folder-drop-root',
    data: { type: 'folder-root' },
  });

  useEffect(() => { fetchTree(section); }, [section]);

  const handleAddRoot = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createFolder(newName.trim(), null, section);
    setNewName('');
    setAdding(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Folders</span>
        {canEdit && (
          <button onClick={() => setAdding(a => !a)} title="New top-level folder">
            <Plus size={14} className="text-gray-400 hover:text-blue-600" />
          </button>
        )}
      </div>

      <div ref={setRootDropRef} className={`flex-1 overflow-y-auto py-1 transition-colors ${isOverRoot ? 'bg-blue-50' : ''}`}>
        {tree.map(node => (
          <FolderNode key={node.id} node={node} section={section} />
        ))}

        {canEdit && adding && (
          <form onSubmit={handleAddRoot} className="flex items-center gap-1 px-3 py-1">
            <input
              autoFocus
              className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs"
              placeholder="Folder name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <button type="submit" className="text-xs text-blue-600 font-medium">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400">&times;</button>
          </form>
        )}

        {tree.length === 0 && !adding && (
          <p className="text-xs text-gray-400 px-3 py-4 text-center">No folders yet.</p>
        )}
      </div>
    </div>
  );
}
