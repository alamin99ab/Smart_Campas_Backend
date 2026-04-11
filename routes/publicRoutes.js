/**
 * 🌐 PUBLIC ROUTES
 * Public access routes - No login required for notices and results
 */

const express = require('express');
const router = express.Router();
const {
    getPublicNotices,
    getPublicNoticeById,
    getLatestPublicNotices,
    getPublicResults,
    searchPublicResults,
    getResultByRollNumber,
    getSchoolInfo,
    getPublicDashboard
} = require('../controllers/publicController');

// Public Notice Routes (No Login Required)
router.get('/:schoolCode/notices/latest', getLatestPublicNotices);
router.get('/:schoolCode/notices/:id', getPublicNoticeById);
router.get('/:schoolCode/notices', getPublicNotices);
router.get('/notices', getPublicNotices);
router.get('/notices/latest', getLatestPublicNotices);

// Public Result Routes (No Login Required)
router.get('/:schoolCode/results', getPublicResults);
router.get('/:schoolCode/results/lookup', getPublicResults);
router.get('/:schoolCode/results/search', searchPublicResults);
router.get('/:schoolCode/result/:rollNumber', getResultByRollNumber);
router.get('/results', getPublicResults);
router.get('/results/search', searchPublicResults);
router.get('/result/:rollNumber', getResultByRollNumber);
router.get('/results/lookup', getPublicResults); // explicit alias for website integrations

// Public School Info (No Login Required)
router.get('/school/:schoolCode', getSchoolInfo);
router.get('/dashboard/:schoolCode', getPublicDashboard);

module.exports = router;
