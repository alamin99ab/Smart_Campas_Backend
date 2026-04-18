const express = require('express');
const router = express.Router();
const { getActivityFeed } = require('../controllers/activityController');
const { protect } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);
router.get('/', getActivityFeed);

module.exports = router;
