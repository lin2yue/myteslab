const nodemailer = require('nodemailer');

// These should match .env.local
const config = {
    host: 'smtpdm.aliyun.com',
    port: 465,
    secure: true,
    auth: {
        user: 'no-reply@tewan.club',
        pass: 'kmHGQgRf4Bdisn2',
    },
};

const transporter = nodemailer.createTransport(config);

async function test() {
    console.log('🚀 Testing mail sending...');
    try {
        const info = await transporter.sendMail({
            from: '"Tewan Club" <no-reply@tewan.club>',
            to: 'lin@2yue.me', // Assuming this is a test recipient or I'll change it if I knew user's test email
            subject: 'Tesla Studio 邮件测试',
            text: '如果您收到这封邮件，说明 SMTP 配置正确。',
            html: '<b>如果您收到这封邮件，说明 SMTP 配置正确。</b>',
        });
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ Failed to send email:', error);
    }
}

test();
