const path = require('path');
const fs = require('fs');
const glob = require('glob');
const OSS = require('ali-oss');

const loadEnvFileIfPresent = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;

    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if (!key) continue;
        if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key]) continue;

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
};

loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env'));
loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env.local'));

const required = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
}

const OSS_CONFIG = {
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'lock-sounds'
};

const client = new OSS(OSS_CONFIG);

const sanitizeAsciiFilename = (filename) => {
    const lastDot = filename.lastIndexOf('.');
    const ext = lastDot >= 0 ? filename.slice(lastDot) : '';
    const base = lastDot >= 0 ? filename.slice(0, lastDot) : filename;

    const safeBase = base.replace(/[^A-Za-z0-9._ -]/g, '_').trim();
    const safeExt = ext.replace(/[^A-Za-z0-9.]/g, '').trim();

    const result = `${safeBase || 'audio'}${safeExt || ''}`;
    return result.length > 0 ? result : 'audio';
};

const escapeQuotedString = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const buildContentDisposition = (filename) => {
    const fallback = sanitizeAsciiFilename(filename);
    const encoded = encodeURIComponent(filename);
    return `attachment; filename="${escapeQuotedString(fallback)}"; filename*=UTF-8''${encoded}`;
};

const guessContentType = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.m4a') return 'audio/mp4';
    if (ext === '.flac') return 'audio/flac';
    return 'application/octet-stream';
};

async function main() {
    const files = glob.sync('uploads/**/*.{mp3,wav,m4a,flac}', { nodir: true });
    if (files.length === 0) {
        console.log('No audio files found.');
        return;
    }

    let ok = 0;
    let failed = 0;

    for (const filePath of files) {
        const filename = path.basename(filePath);
        const albumName = path.basename(path.dirname(filePath));
        const key = `audios/${albumName}/${filename}`;

        const headers = {
            'Content-Disposition': buildContentDisposition(filename),
            'Content-Type': guessContentType(filename),
            'x-oss-metadata-directive': 'REPLACE',
        };

        try {
            await client.copy(key, key, { headers });
            ok += 1;
        } catch (err) {
            failed += 1;
            console.error('Failed:', albumName, filename, err && err.message ? err.message : err);
        }
    }

    console.log(JSON.stringify({ total: files.length, ok, failed }));
}

main();
