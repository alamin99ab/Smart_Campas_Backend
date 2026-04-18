const express = require('express');
const router = express.Router();
const { getOverview } = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);
router.get('/', getOverview);
router.get('/overview', getOverview);

module.exports = router;
