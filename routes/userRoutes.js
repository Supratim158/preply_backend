const router = require('express').Router();
const userController = require('../controllers/userController');
const { verifyTokenAndAuthorization } = require('../middleware/verifyToken');

router.get("/", verifyTokenAndAuthorization, userController.getUser);
router.delete("/", verifyTokenAndAuthorization, userController.deleteUser);
router.put("/", verifyTokenAndAuthorization, userController.updateProfile);

module.exports = router;
