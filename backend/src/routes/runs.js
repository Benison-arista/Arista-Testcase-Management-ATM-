const router = require('express').Router();
const authorize = require('../middleware/authorize');
const {
  getRunFolderTree, createRunFolder, deleteRunFolder,
  getRunItems, addRunItem, updateRunItem, deleteRunItem,
  getReport,
  getReleasesWithFeatures, getRunsByRelease, addRunToRelease, getTCsByFolder, getReleaseRunSummary,
  getTestRunsByRelease, createTestRun,
} = require('../controllers/runController');

// Run folders (legacy) — read: all, write: run_manager only
router.get('/folders', getRunFolderTree);
router.post('/folders', authorize('run_manager'), createRunFolder);
router.delete('/folders/:id', authorize('run_manager'), deleteRunFolder);

// Release-based runs
router.get('/releases-tree', getReleasesWithFeatures);
router.get('/by-release', getRunsByRelease);
router.post('/by-release', authorize('editor', 'run_manager'), addRunToRelease);
router.get('/tcs-by-folder', getTCsByFolder);
router.get('/release-summary', getReleaseRunSummary);
router.get('/test-runs', getTestRunsByRelease);
router.post('/test-runs', authorize('editor', 'run_manager'), createTestRun);

// Report — all authenticated users
router.get('/report', getReport);

// Run items — read: all, write: editor or run_manager
router.get('/', getRunItems);
router.post('/', authorize('editor', 'run_manager'), addRunItem);
router.put('/:id', authorize('editor', 'run_manager'), updateRunItem);
router.delete('/:id', authorize('editor', 'run_manager'), deleteRunItem);

module.exports = router;
