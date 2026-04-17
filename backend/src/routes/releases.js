const router = require('express').Router();
const authorize = require('../middleware/authorize');
const {
  getReleaseTree, createRelease, deleteRelease,
  getFeatures, getFeature, createFeature, updateFeature, deleteFeature,
  getReleaseSummary,
} = require('../controllers/releaseController');

// Release tree
router.get('/tree', getReleaseTree);
router.post('/', authorize('run_manager'), createRelease);
router.delete('/:id', authorize('run_manager'), deleteRelease);

// Features within a release
router.get('/:releaseId/features', getFeatures);
router.get('/:releaseId/features/:id', getFeature);
router.post('/:releaseId/features', authorize('editor', 'run_manager'), createFeature);
router.put('/:releaseId/features/:id', authorize('editor', 'run_manager'), updateFeature);
router.delete('/:releaseId/features/:id', authorize('editor', 'run_manager'), deleteFeature);

// Summary
router.get('/:releaseId/summary', getReleaseSummary);

module.exports = router;
