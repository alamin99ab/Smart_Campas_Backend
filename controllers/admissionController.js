const Admission = require('../models/Admission');
const Student = require('../models/Student');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const cloudinary = require('../config/cloudinary');
const { sendEmail } = require('../utils/emailService');
const { createNotification } = require('../utils/createNotification');
const logger = require('../utils/logger');

async function generateStudentId(schoolCode, year) {
    const prefix = schoolCode.substring(0, 3).toUpperCase();
    const yearShort = year.toString().slice(-2);
    let studentId;
    let exists = true;
    while (exists) {
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        studentId = `${prefix}${yearShort}${random}`;
        const check = await Admission.findOne({ studentId, schoolCode });
        if (!check) exists = false;
    }
    return studentId;
}

exports.applyAdmission = async (req, res) => {
    try {
        const {
            studentName,
            dateOfBirth,
            gender,
            fatherName,
            motherName,
            guardianName,
            guardianPhone,
            guardianEmail,
            guardianRelation,
            address,
            previousSchool,
            appliedClass
        } = req.body;

        if (!studentName || !dateOfBirth || !gender || !fatherName || !guardianName || !guardianPhone || !address || !appliedClass) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        const schoolCode = req.user?.schoolCode || req.body.schoolCode;
        if (!schoolCode) {
            return res.status(400).json({ success: false, message: 'School code required' });
        }

        const admission = await Admission.create({
            schoolCode,
            studentName,
            dateOfBirth: new Date(dateOfBirth),
            gender,
            fatherName,
            motherName,
            guardian: {
                name: guardianName,
                phone: guardianPhone,
                email: guardianEmail,
                relation: guardianRelation || 'Father'
            },
            address,
            previousSchool,
            appliedClass,
            status: 'pending'
        });

        if (req.user) {
            await AuditLog.create({
                user: req.user._id,
                action: 'ADMISSION_APPLIED',
                details: { admissionId: admission._id, studentName, appliedClass },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
        }

        res.status(201).json({
            success: true,
            data: {
                admissionId: admission._id,
                message: 'Admission application submitted successfully',
                status: admission.status
            }
        });
    } catch (err) {
        logger.error('Apply admission error:', { error: err.message, stack: err.stack });
        res.status(500).json({ success: false, message: 'Failed to submit admission application' });
    }
};

exports.uploadDocuments = async (req, res) => {
    try {
        const { id } = req.params;
        const admission = await Admission.findOne({
            _id: id,
            schoolCode: req.user.schoolCode
        });

        if (!admission) {
            return res.status(404).json({ success: false, message: 'Admission not found' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        const uploadedDocs = [];
        for (const file of req.files) {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: `admissions/${admission.schoolCode}`,
                resource_type: 'auto'
            });
            uploadedDocs.push({
                type: req.body.documentType || 'other',
                url: result.secure_url,
                publicId: result.public_id,
                uploadedAt: new Date()
            });
        }

        admission.documents = [...(admission.documents || []), ...uploadedDocs];
        await admission.save();

        res.json({
            success: true,
            data: { documents: admission.documents }
        });
    } catch (err) {
        logger.error('Upload documents error:', { error: err.message, stack: err.stack, admissionId: id });
        res.status(500).json({ success: false, message: 'Failed to upload documents' });
    }
};

exports.approveAdmission = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { id } = req.params;
        const { remarks } = req.body;

        const admission = await Admission.findOne({
            _id: id,
            schoolCode: req.user.schoolCode
        });

        if (!admission) {
            return res.status(404).json({ success: false, message: 'Admission not found' });
        }

        if (admission.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Admission already ${admission.status}` });
        }

        const year = new Date().getFullYear();
        const studentId = await generateStudentId(admission.schoolCode, year);
        admission.studentId = studentId;
        admission.status = 'approved';
        admission.approvedBy = req.user._id;
        admission.approvedAt = new Date();
        if (remarks) admission.remarks = remarks;
        await admission.save();

        if (admission.guardian.email) {
            sendEmail({
                to: admission.guardian.email,
                subject: 'Admission Approved',
                template: 'admission-approved',
                data: {
                    studentName: admission.studentName,
                    studentId,
                    appliedClass: admission.appliedClass
                }
            }).catch(err => logger.error('Email send error:', { error: err.message, admissionId: id }));
        }

        await AuditLog.create({
            user: req.user._id,
            action: 'ADMISSION_APPROVED',
            details: { admissionId: id, studentId },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            data: {
                admission,
                studentId,
                message: 'Admission approved. Student ID generated.'
            }
        });
    } catch (err) {
        logger.error('Approve admission error:', { error: err.message, stack: err.stack, admissionId: id });
        res.status(500).json({ success: false, message: 'Failed to approve admission' });
    }
};

exports.confirmRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const admission = await Admission.findOne({
            _id: id,
            status: 'approved'
        });

        if (!admission) {
            return res.status(404).json({ success: false, message: 'Approved admission not found' });
        }

        const student = await Student.create({
            name: admission.studentName,
            roll: 0,
            studentClass: admission.appliedClass,
            fatherName: admission.fatherName,
            motherName: admission.motherName,
            dateOfBirth: admission.dateOfBirth,
            gender: admission.gender,
            address: admission.address,
            guardian: admission.guardian,
            schoolCode: admission.schoolCode,
            studentId: admission.studentId,
            addedBy: admission.approvedBy
        });

        admission.status = 'registered';
        admission.registeredAt = new Date();
        await admission.save();

        await AuditLog.create({
            user: admission.approvedBy,
            action: 'STUDENT_REGISTERED',
            details: { admissionId: id, studentId: student._id },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            data: {
                student,
                studentId: admission.studentId,
                message: 'Registration confirmed. Student created.'
            }
        });
    } catch (err) {
        logger.error('Confirm registration error:', { error: err.message, stack: err.stack, admissionId: id });
        res.status(500).json({ success: false, message: 'Failed to confirm registration' });
    }
};

exports.getAdmissions = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (status) query.status = status;

        const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, parseInt(limit, 10) || 20);
        const limitNum = Math.min(50, parseInt(limit, 10) || 20);

        const [admissions, total] = await Promise.all([
            Admission.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            Admission.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                admissions,
                total,
                page: parseInt(page, 10) || 1,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch admissions' });
    }
};

exports.getAdmissionById = async (req, res) => {
    try {
        const admission = await Admission.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        }).populate('approvedBy', 'name').lean();

        if (!admission) {
            return res.status(404).json({ success: false, message: 'Admission not found' });
        }

        res.json({ success: true, data: admission });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch admission' });
    }
};
