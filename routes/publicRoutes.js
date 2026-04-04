/**
 * 🌐 PUBLIC ROUTES
 * Public access routes - No login required for notices and results
 */

const express = require('express');
const router = express.Router();
const {
    getPublicNotices,
    getLatestPublicNotices,
    getPublicResults,
    getResultByRollNumber,
    getSchoolInfo,
    getPublicDashboard
} = require('../controllers/publicController');

// Public Notice Routes (No Login Required)
router.get('/notices', getPublicNotices);
router.get('/notices/latest', getLatestPublicNotices);

// Public Result Routes (No Login Required)
router.get('/results', getPublicResults);
router.get('/result/:rollNumber', getResultByRollNumber);
router.get('/results/lookup', getPublicResults); // explicit alias for website integrations

// Public School Info (No Login Required)
router.get('/school/:schoolCode', getSchoolInfo);
router.get('/dashboard/:schoolCode', getPublicDashboard);

module.exports = router;
