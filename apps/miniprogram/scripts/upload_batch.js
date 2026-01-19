const fs = require('fs');
const path = require('path');
const glob = require('glob');
const OSS = require('ali-oss');
const mm = require('music-metadata');
const { execFile } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const execFileAsync = (file, args) => new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8' }, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
    });
});

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

const requiredOss = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET'];
const missingOss = requiredOss.filter((key) => !process.env[key]);

if (missingOss.length) {
    console.error(`Missing env vars: ${missingOss.join(', ')}`);
    process.exit(1);
}

const OSS_CONFIG = {
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'lock-sounds'
};

const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        return value;
    }
};

const encodePathSegments = (input) => String(input || '')
    .split('/')
    .map((segment) => encodeURIComponent(safeDecode(segment)))
    .join('/');

const normalizeBaseUrl = (input) => String(input || '').replace(/\/+$/, '');

const ossBase = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com`;
const publicBase = normalizeBaseUrl(process.env.CDN_DOMAIN) || ossBase;

const requiredSupabase = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingSupabase = requiredSupabase.filter((key) => !process.env[key]);

if (missingSupabase.length) {
    console.error(`Missing env vars: ${missingSupabase.join(', ')}`);
    process.exit(1);
}

const SUPABASE_CONFIG = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
// ---------------------

const ossClient = new OSS(OSS_CONFIG);
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

async function main() {
    console.log('🚀 Starting Batch Uploader...');

    // 1. Scan for Audio Files
    // Path relative to script execution (apps/miniprogram/scripts) -> repo root -> assets/audio
    const assetsAudioDir = path.resolve(__dirname, '../../assets/audio');
    const pattern = path.join(assetsAudioDir, '**/*.{mp3,wav,m4a,flac}');
    const files = glob.sync(pattern);

    if (files.length === 0) {
        console.log('❌ No audio files found in uploads/ folder.');
        return;
    }

    console.log(`📂 Found ${files.length} audio files.`);

    for (const filePath of files) {
        await processFile(filePath);
    }

    console.log('✅ All done!');
}

async function processFile(filePath) {
    try {
        const filename = path.basename(filePath);
        const dir = path.dirname(filePath);
        const albumName = path.basename(dir); // Folder name is Album

        console.log(`\nProcessing: [${albumName}] ${filename}`);

        // 2. Parse Metadata
        // Tags from filename: "Title [Tag1, Tag2].mp3"
        let title = filename.replace(/\.[^/.]+$/, ""); // remove extension
        let tags = [];

        const tagMatch = title.match(/\[(.*?)\]/);
        if (tagMatch) {
            tags = tagMatch[1].split(',').map(t => t.trim());
            title = title.replace(/\[.*?\]/, '').trim();
        }

        // Default tag from Album if none
        if (tags.length === 0) tags.push(albumName);

        const duration = await getDurationSeconds(filePath);

        // 3. Upload Audio to OSS
        const ossKey = `audios/${albumName}/${filename}`;

        const contentDisposition = buildContentDisposition(filename);

        console.log(`   ⬆️ Uploading...`);
        await ossClient.put(ossKey, filePath, {
            headers: {
                'Content-Disposition': contentDisposition
            }
        });


        const fileUrl = `${publicBase}/${encodePathSegments(ossKey)}`;

        console.log(`   ☁️ Uploaded Audio: ${fileUrl}`);

        // 4. Handle Cover Image
        let coverUrl = null;

        // 4.1 Check for Specific Cover (e.g. "Song Name.jpg")
        // Try both .jpg and .png
        const baseName = filename.replace(/\.[^/.]+$/, "");
        const specificJpg = path.join(dir, `${baseName}.jpg`);
        const specificPng = path.join(dir, `${baseName}.png`);

        let targetCoverPath = null;
        let targetCoverName = null;

        if (fs.existsSync(specificJpg)) {
            targetCoverPath = specificJpg;
            targetCoverName = `${baseName}.jpg`;
        } else if (fs.existsSync(specificPng)) {
            targetCoverPath = specificPng;
            targetCoverName = `${baseName}.png`;
        } else if (fs.existsSync(path.join(dir, 'cover.jpg'))) {
            // 4.2 Fallback to Album Cover
            targetCoverPath = path.join(dir, 'cover.jpg');
            targetCoverName = 'cover.jpg';
        }

        if (targetCoverPath) {
            // We upload specific covers to a distinct path, but album covers can be shared?
            // To keep it simple, we just upload whatever we found to the specific song's metadata.
            // If it's the album cover, we might be uploading it multiple times (once for each song), 
            // but that's fine for this scale and ensures simpler logic.
            let coverKeyName = targetCoverName;
            let coverVersionQuery = '';
            if (coverKeyName === 'cover.jpg') {
                coverKeyName = 'cover.v2.jpg';
                coverVersionQuery = '?v=2';
            }

            const coverKey = `audios/${albumName}/${coverKeyName}`;

            await ossClient.put(coverKey, targetCoverPath);

            coverUrl = `${publicBase}/${encodePathSegments(coverKey)}${coverVersionQuery}`;


            console.log(`   🖼️ Uploaded Cover: ${coverUrl}`);
        }

        // 5. Insert to Supabase
        const { data, error } = await supabase
            .from('audios')
            .upsert({
                title: title,
                album: albumName,
                tags: tags,
                duration: duration || null,
                file_url: fileUrl,
                cover_url: coverUrl
            }, { onConflict: 'file_url' }) // Dedupe based on URL? Or maybe upsert isn't perfect here if we don't have a unique constraint other than ID. 
            // Ideally we search by title+album, but let's just insert for now. 
            // Actually, without a unique constraint, upsert works as insert. 
            // Let's modify to insert.
            .select();

        if (error) {
            console.error('   ❌ DB Error:', error.message);
        } else {
            console.log(`   ✨ DB Saved: ID ${data[0].id}`);
        }

    } catch (err) {
        console.error(`   ❌ Failed to process ${filePath}:`, err);
    }
}

main();
