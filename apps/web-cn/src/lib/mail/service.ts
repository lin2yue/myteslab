import { sendMail } from './transporter';

export async function sendActivationEmail(email: string, token: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tewan.club';
    // Use the localized route if needed, but for API it should be fine
    const activationLink = `${appUrl}/api/auth/verify-email?token=${token}`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #333;">激活您的特别版 特玩 账户</h2>
            <p>感谢您注册！请点击下方的按钮来激活您的账户：</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${activationLink}" 
                   style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                   激活账户
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">或者复制此链接到浏览器：</p>
            <p style="color: #0066cc; font-size: 12px; word-break: break-all;">${activationLink}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">此链接将在 24 小时内失效。如果您没有注册过此账户，请忽略此邮件。</p>
        </div>
    `;

    return await sendMail({
        to: email,
        subject: '激活您的 特玩 账户',
        html,
    });
}
