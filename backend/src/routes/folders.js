const router = require('express').Router();
const authorize = require('../middleware/authorize');
const { getTree, createFolder, moveFolder, deleteFolder } = require('../controllers/folderController');

router.get('/', getTree);
router.post('/', authorize('editor', 'run_manager'), createFolder);
router.patch('/:id/move', authorize('editor', 'run_manager'), moveFolder);
router.delete('/:id', authorize('editor', 'run_manager'), deleteFolder);

module.exports = router;
