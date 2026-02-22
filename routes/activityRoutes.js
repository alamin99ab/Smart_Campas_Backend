const express = require('express');
const router = express.Router();
const { getActivityFeed } = require('../controllers/activityController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', getActivityFeed);

module.exports = router;
