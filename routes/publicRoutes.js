/**
 * 🌐 PUBLIC ROUTES
 * Public access routes - No login required for notices and results
 */

const express = require('express');
const router = express.Router();
const {
    getPublicNotices,
    getPublicResults,
    getResultByRollNumber,
    getSchoolInfo,
    getPublicDashboard
} = require('../controllers/publicController');

// Public Notice Routes (No Login Required)
router.get('/notices', getPublicNotices);

// Public Result Routes (No Login Required)
router.get('/results', getPublicResults);
router.get('/result/:rollNumber', getResultByRollNumber);

// Public School Info (No Login Required)
router.get('/school/:schoolCode', getSchoolInfo);
router.get('/dashboard/:schoolCode', getPublicDashboard);

module.exports = router;
