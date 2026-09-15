process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.STAFF_INVITE_CODE = 'test-invite-code';
// No SMTP configuration: the email service logs to email_logs and skips sending.
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
