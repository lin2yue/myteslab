import { createHash, randomInt } from 'crypto';

const DEFAULT_SECRET = 'tewan_otp_secret';
const OTP_SECRET = process.env.OTP_HASH_SECRET || DEFAULT_SECRET;

if (process.env.NODE_ENV === 'production' && OTP_SECRET === DEFAULT_SECRET) {
    console.error('CRITICAL: OTP_HASH_SECRET is not configured in production! Please set it in environment variables.');
    // In strict production, we might want to throw error, but for now we log severe error
}

export function generateOtpCode() {
    const code = String(randomInt(100000, 999999));
    return code;
}

export function hashOtp(code: string) {
    return createHash('sha256').update(`${code}.${OTP_SECRET}`).digest('hex');
}
