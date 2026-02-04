export const SESSION_COOKIE_NAME = 'tewan_session';
export const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
export const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);
export const OTP_RESEND_INTERVAL_SECONDS = Number(process.env.OTP_RESEND_INTERVAL_SECONDS || 60);
export const OTP_MAX_PER_DAY = Number(process.env.OTP_MAX_PER_DAY || 10);
