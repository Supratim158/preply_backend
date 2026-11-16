
const router = require('express').Router();

const controller = require('../controllers/chatBotController');

// Import your existing JWT authentication middleware
const {
  verifyTokenAndAuthorization
} = require("../middleware/verifyToken");

// All chat endpoints require authentication
router.use(verifyTokenAndAuthorization);

// Create new conversation
router.post('/', controller.createChat);

// Get all conversations
router.get('/', controller.listChats);

// Get specific conversation
router.get('/:chatId', controller.getChat);

// Delete conversation
router.delete('/:chatId', controller.deleteChat);

// Send message
router.post('/:chatId/messages', controller.sendMessage);

module.exports = router;
