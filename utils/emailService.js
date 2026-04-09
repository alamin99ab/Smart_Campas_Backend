/**
 * 📧 EMAIL SERVICE - PRODUCTION READY
 * Simple email service for production deployment
 */

const nodemailer = require('nodemailer');

// Create transporter if email configuration is available
let transporter = null;
const emailPassword = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && emailPassword) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: emailPassword
        }
    });
}

/**
 * Send email
 */
const sendEmail = async (options) => {
    try {
        if (!transporter) {
            console.log('📧 Email service not configured - skipping email send');
            return { success: false, message: 'Email service not configured' };
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: options.to,
            subject: options.subject,
            html: options.html || options.text,
            text: options.text
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('📧 Email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('📧 Email send error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendEmail
};
