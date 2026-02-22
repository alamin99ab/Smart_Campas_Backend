const express = require('express');
const router = express.Router();
const { getSchoolByCode } = require('../controllers/publicController');

router.get('/school/:code', getSchoolByCode);

module.exports = router;
