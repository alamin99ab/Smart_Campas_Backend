const Class = require('../models/Class');
const Student = require('../models/Student');

/**
 * Resolve a Student collection _id from a school User account (role student).
 * Principal onboarding often creates User rows with classId, section, rollNumber.
 */
async function resolveStudentObjectIdFromUser(user) {
    if (!user || !user.schoolCode || user.schoolCode === 'SUPER_ADMIN') {
        return null;
    }

    let studentClass = user.studentClass;
    let section = user.section;
    const rollRaw = user.rollNumber;

    if (user.classId) {
        const cls = await Class.findById(user.classId).select('className section').lean();
        if (cls) {
            studentClass = studentClass || cls.className;
            section = section || cls.section;
        }
    }

    const roll =
        rollRaw !== undefined && rollRaw !== null && rollRaw !== ''
            ? parseInt(String(rollRaw), 10)
            : NaN;

    if (!studentClass || !Number.isFinite(roll)) {
        return null;
    }

    const sectionNorm = section ? String(section).toUpperCase() : undefined;

    let doc = await Student.findOne({
        schoolCode: user.schoolCode,
        studentClass: String(studentClass),
        ...(sectionNorm ? { section: sectionNorm } : {}),
        roll,
        isActive: true
    })
        .select('_id')
        .lean();

    if (!doc && sectionNorm) {
        doc = await Student.findOne({
            schoolCode: user.schoolCode,
            studentClass: String(studentClass),
            roll,
            isActive: true
        })
            .select('_id')
            .lean();
    }

    return doc ? doc._id : null;
}

module.exports = { resolveStudentObjectIdFromUser };
