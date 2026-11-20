const express = require('express');
const router = express.Router();
const githubController = require('../controllers/githubController');
const { verifyTokenAndAuthorization } = require('../middleware/verifyToken');

// Public OAuth callback (GitHub redirects here directly)
router.get('/callback', githubController.callback);

// Authenticated endpoints
router.get('/connect', verifyTokenAndAuthorization, githubController.connect);
router.get('/status', verifyTokenAndAuthorization, githubController.status);
router.get('/repos', verifyTokenAndAuthorization, githubController.repos);
router.post('/sync', verifyTokenAndAuthorization, githubController.sync);
router.post('/analyze', verifyTokenAndAuthorization, githubController.analyze);
router.get('/insights', verifyTokenAndAuthorization, githubController.insights);
router.delete('/disconnect', verifyTokenAndAuthorization, githubController.disconnect);

module.exports = router;
