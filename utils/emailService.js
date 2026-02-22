const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

function buildHtmlFromData(data) {
    if (!data || typeof data !== 'object') return '';
    return Object.entries(data).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('');
}

exports.sendEmail = async ({ to, subject, template, data, html: htmlInput }) => {
    const html = htmlInput || (template && data ? buildHtmlFromData(data) : '');
    if (!transporter) {
        return { success: false, simulated: true };
    }
    try {
        const info = await transporter.sendMail({
            from: `"Smart Campus" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to,
            subject,
            html: html || subject
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send email:', error.message);
        return { success: false, error: error.message };
    }
};