const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);
router.get('/', globalSearch);

module.exports = router;
