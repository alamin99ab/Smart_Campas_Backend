const AuditLog = require('../models/AuditLog');
const {
    createExportPayload,
    writeExcel,
    writePdf,
    ExportServiceError
} = require('../services/schoolExportService');

const safeAudit = async (req, exportType, payload) => {
    try {
        await AuditLog.create({
            user: req.user?.isEnvBased ? undefined : req.user?._id || undefined,
            userId: req.user?.isEnvBased ? undefined : req.user?._id || undefined,
            isEnvUser: Boolean(req.user?.isEnvBased),
            envUserEmail: req.user?.isEnvBased ? req.user?.email || null : null,
            action: `EXPORT_${String(exportType || '').toUpperCase().replace(/-/g, '_')}`,
            details: {
                exportType,
                format: payload.format,
                generatedAt: payload.generatedAt,
                filters: payload.filters,
                rowCounts: (payload.excelSheets || []).map((sheet) => ({
                    sheet: sheet.name,
                    rows: (sheet.rows || []).length
                })),
                requesterRole: req.user?.role
            },
            schoolId: payload.school?.schoolId || undefined,
            schoolCode: payload.school?.schoolCode || req.user?.schoolCode || undefined,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    } catch (error) {
        console.error('Export audit creation failed:', error.message);
    }
};

const handleExport = (exportType) => async (req, res) => {
    try {
        const payload = await createExportPayload({
            exportType,
            format: req.query.format,
            user: req.user,
            tenant: req.tenant,
            query: req.query
        });

        await safeAudit(req, exportType, payload);

        if (payload.format === 'xlsx') {
            await writeExcel(res, payload);
            return;
        }

        await writePdf(res, payload);
    } catch (error) {
        if (res.headersSent) {
            return;
        }

        if (error instanceof ExportServiceError) {
            return res.status(error.statusCode).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }

        console.error('Export controller error:', error);
        return res.status(500).json({
            success: false,
            code: 'EXPORT_FAILED',
            message: 'Failed to generate export'
        });
    }
};

exports.exportStudents = handleExport('students');
exports.exportTeachers = handleExport('teachers');
exports.exportAttendance = handleExport('attendance');
exports.exportResults = handleExport('results');
exports.exportFees = handleExport('fees');
exports.exportNotices = handleExport('notices');
exports.exportFullSchoolSummary = handleExport('full-school-summary');

