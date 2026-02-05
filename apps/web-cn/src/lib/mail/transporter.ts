import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.DM_SMTP_HOST || 'smtpdm.aliyun.com',
    port: parseInt(process.env.DM_SMTP_PORT || '465'),
    secure: process.env.DM_SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.DM_SMTP_USER,
        pass: process.env.DM_SMTP_PASS,
    },
});

export interface SendMailParams {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export async function sendMail(params: SendMailParams) {
    const { to, subject, text, html } = params;
    const fromAlias = process.env.DM_FROM_ALIAS || 'Tewan Club';
    const fromAddress = process.env.DM_SMTP_USER;

    try {
        const info = await transporter.sendMail({
            from: `"${fromAlias}" <${fromAddress}>`,
            to,
            subject,
            text,
            html,
        });
        console.log('[Mail] Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[Mail] Failed to send email:', error);
        return { success: false, error };
    }
}
