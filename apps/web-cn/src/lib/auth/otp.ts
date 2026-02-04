import { createHash, randomInt } from 'crypto';

const OTP_SECRET = process.env.OTP_HASH_SECRET || 'tewan_otp_secret';

export function generateOtpCode() {
    const code = String(randomInt(100000, 999999));
    return code;
}

export function hashOtp(code: string) {
    return createHash('sha256').update(`${code}.${OTP_SECRET}`).digest('hex');
}
