const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { execFile } = require('child_process');
const mm = require('music-metadata');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const CDN_DOMAIN = 'https://cdn.tewan.club';

const execFileAsync = (file, args) => new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8' }, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
    });
});

const getDurationSeconds = async (filePath) => {
    try {
        const metadata = await mm.parseFile(filePath);
        const seconds = Number(metadata && metadata.format && metadata.format.duration);
        if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);
    } catch (err) {
    }

    try {
        const stdout = await execFileAsync('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath,
        ]);
        const seconds = Number(String(stdout).trim());
        if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);
    } catch (err) {
    }

    return null;
};

async function main() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const pattern = 'uploads/**/*.{mp3,wav,m4a,flac}';
    const files = glob.sync(pattern);

    if (files.length === 0) {
        console.log('No audio files found.');
        return;
    }

    let updated = 0;
    let skipped = 0;

    for (const filePath of files) {
        const filename = path.basename(filePath);
        const dir = path.dirname(filePath);
        const albumName = path.basename(dir);
        const ossKey = `audios/${albumName}/${filename}`;
        const fileUrl = `${CDN_DOMAIN}/${encodeURI(ossKey)}`;

        const duration = await getDurationSeconds(filePath);
        if (!duration) {
            skipped += 1;
            continue;
        }

        const { error } = await supabase
            .from('audios')
            .update({ duration })
            .eq('file_url', fileUrl)
            .or('duration.is.null,duration.eq.0');

        if (error) {
            console.error('Update failed:', albumName, filename, error.message);
            continue;
        }

        updated += 1;
    }

    console.log(JSON.stringify({ total: files.length, updated, skipped }));
}

main();
