/**
 * 📝 EXAM CONTROLLER
 * Exam management for principals
 */

const Exam = require('../models/Exam');

/**
 * @desc    Create Exam
 * @route   POST /api/principal/exams
 * @access  Principal only
 */
exports.createExam = async (req, res) => {
    try {
        const { examName, examType, classId, subjects, startDate, endDate, totalMarks } = req.body;
        const schoolCode = req.user.schoolCode;

        const exam = new Exam({
            examName,
            examType,
            classId,
            subjects,
            startDate,
            endDate,
            totalMarks,
            schoolCode,
            createdBy: req.user.id
        });

        await exam.save();

        res.status(201).json({
            success: true,
            message: 'Exam created successfully',
            data: exam
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get all exams
 * @route   GET /api/principal/exams
 * @access  Principal only
 */
exports.getExams = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const exams = await Exam.find({ schoolCode })
            .populate('classId', 'className section')
            .sort({ startDate: -1 });

        res.status(200).json({
            success: true,
            data: exams
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Update Exam
 * @route   PUT /api/principal/exams/:id
 * @access  Principal only
 */
exports.updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const { examName, examType, classId, subjects, startDate, endDate, totalMarks } = req.body;
        const schoolCode = req.user.schoolCode;

        const exam = await Exam.findOneAndUpdate(
            { _id: id, schoolCode },
            { examName, examType, classId, subjects, startDate, endDate, totalMarks },
            { new: true, runValidators: true }
        );

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Exam updated successfully',
            data: exam
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Delete Exam
 * @route   DELETE /api/principal/exams/:id
 * @access  Principal only
 */
exports.deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.user.schoolCode;

        const exam = await Exam.findOneAndDelete({ _id: id, schoolCode });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Exam deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Publish Exam Results
 * @route   POST /api/principal/exams/:id/publish
 * @access  Principal only
 */
exports.publishExamResults = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.user.schoolCode;

        const exam = await Exam.findOneAndUpdate(
            { _id: id, schoolCode },
            { resultsPublished: true, publishedDate: new Date() },
            { new: true }
        );

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Exam results published successfully',
            data: exam
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
