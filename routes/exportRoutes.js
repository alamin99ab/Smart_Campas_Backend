const express = require('express');

const router = express.Router();

const {
    exportStudents,
    exportTeachers,
    exportAttendance,
    exportResults,
    exportFees,
    exportNotices,
    exportFullSchoolSummary
} = require('../controllers/exportController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

// Individual export routes with specific role restrictions
router.get('/students', authorize('principal', 'admin', 'super_admin'), exportStudents);
router.get('/teachers', authorize('principal', 'admin', 'super_admin'), exportTeachers);
router.get('/attendance', authorize('principal', 'admin', 'super_admin'), exportAttendance);
router.get('/results', authorize('principal', 'admin', 'super_admin'), exportResults);
router.get('/fees', authorize('principal', 'admin', 'accountant', 'super_admin'), exportFees);
router.get('/notices', authorize('principal', 'admin', 'super_admin'), exportNotices);
router.get('/full-school-summary', authorize('principal', 'admin', 'super_admin'), exportFullSchoolSummary);

router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'School export API',
        data: {
            endpoints: [
                'GET /api/exports/students?format=xlsx|pdf',
                'GET /api/exports/teachers?format=xlsx|pdf',
                'GET /api/exports/attendance?format=xlsx|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD',
                'GET /api/exports/results?format=xlsx|pdf&examId=...',
                'GET /api/exports/fees?format=xlsx|pdf&month=1-12&year=YYYY',
                'GET /api/exports/notices?format=xlsx|pdf',
                'GET /api/exports/full-school-summary?format=xlsx|pdf'
            ],
            superAdminNote: 'Super admins must pass schoolId or schoolCode query parameter'
        }
    });
});


module.exports = router;

