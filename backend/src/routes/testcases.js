const router = require('express').Router();
const authorize = require('../middleware/authorize');
const {
  listTestcases, getTestcase, searchTestcases,
  createTestcase, updateTestcase, deleteTestcase,
  importTestcases, getHistory, getTestcaseCounts,
} = require('../controllers/testcaseController');

// Read — any authenticated user
router.get('/counts', getTestcaseCounts);
router.get('/search', searchTestcases);
router.get('/', listTestcases);
router.get('/:id/history', getHistory);
router.get('/:id', getTestcase);

// Write — editor or run_manager
router.post('/import', authorize('editor', 'run_manager'), importTestcases);
router.post('/', authorize('editor', 'run_manager'), createTestcase);
router.put('/:id', authorize('editor', 'run_manager'), updateTestcase);
router.delete('/:id', authorize('editor', 'run_manager'), deleteTestcase);

module.exports = router;
