const router = require('express').Router();
const authorize = require('../middleware/authorize');
const {
  getRunFolderTree, createRunFolder, deleteRunFolder,
  getRunItems, addRunItem, updateRunItem, deleteRunItem,
  getReport,
} = require('../controllers/runController');

// Run folders — read: all, write: run_manager only
router.get('/folders', getRunFolderTree);
router.post('/folders', authorize('run_manager'), createRunFolder);
router.delete('/folders/:id', authorize('run_manager'), deleteRunFolder);

// Report — all authenticated users
router.get('/report', getReport);

// Run items — read: all, write: editor or run_manager
router.get('/', getRunItems);
router.post('/', authorize('editor', 'run_manager'), addRunItem);
router.put('/:id', authorize('editor', 'run_manager'), updateRunItem);
router.delete('/:id', authorize('editor', 'run_manager'), deleteRunItem);

module.exports = router;
