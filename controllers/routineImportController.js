/**
 * Routine Import Controller
 * Handles PDF upload, parsing, preview, and import confirmation
 */

const RoutinePdfParser = require('../utils/routinePdfParser');
const AdvancedRoutine = require('../models/AdvancedRoutine');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Room = require('../models/Room');
const AcademicSession = require('../models/AcademicSession');
const AuditLog = require('../models/AuditLog');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

/**
 * Upload and parse routine PDF
 */
const uploadAndParseRoutine = async (req, res) => {
    try {
        const { schoolId, sessionId, classId, sectionId } = req.body;
        
        // Validate required fields
        if (!schoolId || !sessionId || !classId) {
            return res.status(400).json({
                success: false,
                message: 'schoolId, sessionId, and classId are required'
            });
        }

        // Verify school isolation
        if (req.user.schoolId.toString() !== schoolId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Invalid school scope'
            });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No PDF file uploaded'
            });
        }

        // Save file temporarily for parsing
        const tempDir = path.join(__dirname, '../temp');
        await fs.mkdir(tempDir, { recursive: true });
        
        const fileName = `${crypto.randomUUID()}.pdf`;
        const filePath = path.join(tempDir, fileName);
        
        try {
            await fs.writeFile(filePath, req.file.buffer);
            
            // Parse the PDF
            const parser = new RoutinePdfParser();
            const parseOptions = {
                schoolId,
                sessionId,
                classId,
                sectionId
            };
            
            const parsedData = await parser.parsePdf(filePath, parseOptions);
            
            // Clean up temp file
            await fs.unlink(filePath);
            
            // Validate references
            const validationResults = await validateRoutineReferences(parsedData, schoolId);
            
            // Generate import batch ID
            const importBatchId = crypto.randomUUID();
            
            // Store parsed data temporarily (could use Redis in production)
            req.app.locals.routineImportPreview = {
                importBatchId,
                parsedData,
                validationResults,
                uploadedBy: req.user._id,
                uploadedAt: new Date(),
                originalFileName: req.file.originalname
            };
            
            res.json({
                success: true,
                data: {
                    importBatchId,
                    preview: parsedData,
                    validation: validationResults,
                    originalFileName: req.file.originalname,
                    parserVersion: parser.parserVersion
                }
            });
            
        } catch (parseError) {
            // Clean up temp file on error
            try {
                await fs.unlink(filePath);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            
            throw parseError;
        }
        
    } catch (error) {
        console.error('Routine import error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process routine PDF'
        });
    }
};

/**
 * Confirm and import routine data
 */
const confirmRoutineImport = async (req, res) => {
    const { withTransaction } = require('../utils/transactionHelper');
    
    try {
        const { importBatchId, importMode = 'merge' } = req.body;
        
        if (!importBatchId) {
            return res.status(400).json({
                success: false,
                message: 'importBatchId is required'
            });
        }
        
        // Retrieve stored preview data
        const storedData = req.app.locals.routineImportPreview;
        if (!storedData || storedData.importBatchId !== importBatchId) {
            return res.status(404).json({
                success: false,
                message: 'Import session not found or expired'
            });
        }
        
        const { parsedData, validationResults, uploadedBy, uploadedAt, originalFileName } = storedData;
        
        // Verify user permissions
        if (req.user._id.toString() !== uploadedBy.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Invalid import session'
            });
        }
        
        // Check for critical validation errors
        if (validationResults.criticalErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot import due to critical validation errors',
                errors: validationResults.criticalErrors
            });
        }
        
        // Import routine entries within transaction
        const importResult = await withTransaction(async (session) => {
            return await importRoutineEntries(
                parsedData,
                validationResults,
                importMode,
                req.user,
                session
            );
        });
        
        // Clean up stored preview data (outside transaction)
        delete req.app.locals.routineImportPreview;
        
        // Create audit log (separate transaction to avoid conflicts)
        await AuditLog.create({
            schoolId: parsedData.schoolId,
            userId: req.user._id,
            action: 'ROUTINE_IMPORT',
            details: {
                importBatchId,
                originalFileName,
                importMode,
                entriesImported: importResult.imported,
                entriesUpdated: importResult.updated,
                entriesSkipped: importResult.skipped,
                conflicts: importResult.conflicts.length
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        res.json({
            success: true,
            data: {
                importBatchId,
                result: importResult,
                validation: validationResults
            }
        });
        
    } catch (error) {
        console.error('Routine import confirmation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to import routine'
        });
    }
};

/**
 * Validate routine references (classes, subjects, teachers, etc.)
 */
const validateRoutineReferences = async (parsedData, schoolId) => {
    const validationResults = {
        validEntries: [],
        invalidEntries: [],
        warnings: [],
        criticalErrors: [],
        referenceChecks: {
            classes: {},
            sections: {},
            subjects: {},
            teachers: {},
            rooms: {}
        }
    };
    
    try {
        // Check class
        if (parsedData.classId) {
            const classDoc = await Class.findOne({ _id: parsedData.classId, schoolId });
            validationResults.referenceChecks.classes[parsedData.classId] = {
                exists: !!classDoc,
                name: classDoc?.className || 'Unknown'
            };
            
            if (!classDoc) {
                validationResults.criticalErrors.push(`Class not found: ${parsedData.classId}`);
            }
        }
        
        // Check section
        if (parsedData.sectionId) {
            const sectionDoc = await Section.findOne({ _id: parsedData.sectionId, schoolId });
            validationResults.referenceChecks.sections[parsedData.sectionId] = {
                exists: !!sectionDoc,
                name: sectionDoc?.sectionName || 'Unknown'
            };
            
            if (!sectionDoc) {
                validationResults.warnings.push(`Section not found: ${parsedData.sectionId}`);
            }
        }
        
        // Check subjects, teachers, rooms for each entry
        for (const entry of parsedData.entries) {
            const entryValidation = { ...entry, issues: [] };
            
            // Check subject
            const subjectDoc = await Subject.findOne({
                schoolId,
                $or: [
                    { subjectName: { $regex: entry.subjectName, $options: 'i' } },
                    { subjectCode: { $regex: entry.subjectName, $options: 'i' } }
                ]
            });
            
            if (subjectDoc) {
                entryValidation.subjectId = subjectDoc._id;
                entryValidation.subjectMatch = true;
            } else {
                entryValidation.issues.push(`Subject not found: ${entry.subjectName}`);
                validationResults.warnings.push(`Subject not found: ${entry.subjectName}`);
            }
            
            // Check teacher
            if (entry.teacherName && entry.teacherName !== 'Not Assigned') {
                const teacherDoc = await User.findOne({
                    schoolId,
                    role: 'teacher',
                    $or: [
                        { name: { $regex: entry.teacherName, $options: 'i' } },
                        { firstName: { $regex: entry.teacherName, $options: 'i' } },
                        { lastName: { $regex: entry.teacherName, $options: 'i' } }
                    ]
                });
                
                if (teacherDoc) {
                    entryValidation.teacherId = teacherDoc._id;
                    entryValidation.teacherMatch = true;
                } else {
                    entryValidation.issues.push(`Teacher not found: ${entry.teacherName}`);
                    validationResults.warnings.push(`Teacher not found: ${entry.teacherName}`);
                }
            }
            
            // Check room
            if (entry.roomName && entry.roomName !== 'TBD') {
                const roomDoc = await Room.findOne({
                    schoolId,
                    $or: [
                        { roomNumber: { $regex: entry.roomName, $options: 'i' } },
                        { roomName: { $regex: entry.roomName, $options: 'i' } }
                    ]
                });
                
                if (roomDoc) {
                    entryValidation.roomId = roomDoc._id;
                    entryValidation.roomMatch = true;
                } else {
                    entryValidation.issues.push(`Room not found: ${entry.roomName}`);
                    validationResults.warnings.push(`Room not found: ${entry.roomName}`);
                }
            }
            
            // Check for time conflicts
            const conflictCheck = await checkTimeConflicts(entry, parsedData.schoolId);
            if (conflictCheck.hasConflict) {
                entryValidation.issues.push('Time conflict detected');
                entryValidation.conflict = conflictCheck;
                validationResults.warnings.push(`Time conflict for ${entry.dayOfWeek} period ${entry.periodNumber}`);
            }
            
            if (entryValidation.issues.length === 0) {
                validationResults.validEntries.push(entryValidation);
            } else {
                validationResults.invalidEntries.push(entryValidation);
            }
        }
        
    } catch (error) {
        validationResults.criticalErrors.push(`Validation error: ${error.message}`);
    }
    
    return validationResults;
};

/**
 * Check for time conflicts
 */
const checkTimeConflicts = async (entry, schoolId) => {
    try {
        const existingRoutine = await AdvancedRoutine.findOne({
            schoolId,
            day: entry.dayOfWeek.toLowerCase(),
            periodNumber: entry.periodNumber,
            status: { $ne: 'cancelled' }
        });
        
        return {
            hasConflict: !!existingRoutine,
            conflictingEntry: existingRoutine
        };
    } catch (error) {
        return { hasConflict: false, error: error.message };
    }
};

/**
 * Import routine entries to database
 */
const importRoutineEntries = async (parsedData, validationResults, importMode, user, session) => {
    const result = {
        imported: 0,
        updated: 0,
        skipped: 0,
        conflicts: []
    };
    
    try {
        const validEntries = validationResults.validEntries;
        const operations = [];
        
        // Prepare all operations first
        for (const entry of validEntries) {
            try {
                // Check if entry already exists
                const existingEntry = await AdvancedRoutine.findOne({
                    schoolId: parsedData.schoolId,
                    classId: parsedData.classId,
                    sectionId: parsedData.sectionId,
                    day: entry.dayOfWeek.toLowerCase(),
                    periodNumber: entry.periodNumber,
                    status: { $ne: 'cancelled' }
                }).session(session);
                
                if (existingEntry) {
                    if (importMode === 'replace') {
                        // Prepare update operation
                        operations.push({
                            type: 'update',
                            id: existingEntry._id,
                            data: {
                                subjectId: entry.subjectId,
                                teacherId: entry.teacherId,
                                roomId: entry.roomId,
                                roomNumber: entry.roomName,
                                source: 'pdf_import',
                                importBatchId: validationResults.importBatchId,
                                importMetadata: {
                                    originalFileName: validationResults.originalFileName,
                                    parsedAt: new Date(),
                                    parserVersion: '1.0.0',
                                    parseWarnings: entry.issues || [],
                                    originalData: entry
                                },
                                updatedBy: user._id,
                                updatedAt: new Date()
                            }
                        });
                        result.updated++;
                    } else {
                        // Skip existing entry
                        result.skipped++;
                    }
                } else {
                    // Prepare create operation
                    operations.push({
                        type: 'create',
                        data: {
                            schoolId: parsedData.schoolId,
                            academicSessionId: parsedData.sessionId,
                            classId: parsedData.classId,
                            sectionId: parsedData.sectionId,
                            day: entry.dayOfWeek.toLowerCase(),
                            periodNumber: entry.periodNumber,
                            startTime: entry.startTime,
                            endTime: entry.endTime,
                            subjectId: entry.subjectId,
                            teacherId: entry.teacherId,
                            roomId: entry.roomId,
                            roomNumber: entry.roomName,
                            source: 'pdf_import',
                            importBatchId: validationResults.importBatchId,
                            importMetadata: {
                                originalFileName: validationResults.originalFileName,
                                parsedAt: new Date(),
                                parserVersion: '1.0.0',
                                parseWarnings: entry.issues || [],
                                originalData: entry
                            },
                            status: 'draft',
                            createdBy: user._id,
                            updatedBy: user._id
                        }
                    });
                    result.imported++;
                }
                
            } catch (entryError) {
                result.conflicts.push({
                    entry,
                    error: entryError.message
                });
            }
        }
        
        // Execute all operations atomically within the transaction
        const updates = operations.filter(op => op.type === 'update');
        const creates = operations.filter(op => op.type === 'create');
        
        // Execute bulk updates
        if (updates.length > 0) {
            const bulkOps = updates.map(op => ({
                updateOne: {
                    filter: { _id: op.id },
                    update: { $set: op.data }
                }
            }));
            await AdvancedRoutine.bulkWrite(bulkOps, { session });
        }
        
        // Execute bulk creates
        if (creates.length > 0) {
            await AdvancedRoutine.create(creates.map(op => op.data), { session });
        }
        
    } catch (error) {
        throw new Error(`Import failed: ${error.message}`);
    }
    
    return result;
};

module.exports = {
    uploadAndParseRoutine,
    confirmRoutineImport,
    upload
};
