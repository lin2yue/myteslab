const fs = require('fs');
const path = require('path');
const https = require('https');
const puppeteer = require('puppeteer');

const TARGET_URL = 'https://github.com/teslamotors/custom-wraps/tree/29df5c045e9b6443effdcf3d62034a7567bfaeed/modely/example';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/teslamotors/custom-wraps/29df5c045e9b6443effdcf3d62034a7567bfaeed/modely/example';
// Use "Model Y" directory to match the catalog structure
const DOWNLOAD_DIR = path.join(__dirname, '../uploads/catalog/Model-Y/wraps/Official');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function main() {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    console.log(`Launching browser to scrape: ${TARGET_URL}`);
    // Launch pupeteer
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

        // Extract file names that end with .png
        // The structure is the same as previous GitHub page
        const files = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href$=".png"]'));
            return links.map(link => link.innerText.trim()).filter(text => text.endsWith('.png'));
        });

        console.log(`Found ${files.length} images.`);

        const uniqueFiles = [...new Set(files)];

        for (const filename of uniqueFiles) {
            const rawUrl = `${RAW_BASE_URL}/${filename}`;
            const destPath = path.join(DOWNLOAD_DIR, filename);

            console.log(`Downloading ${filename}...`);
            try {
                await downloadFile(rawUrl, destPath);
            } catch (err) {
                console.error(`Error downloading ${filename}:`, err.message);
            }
        }

    } catch (err) {
        console.error('Error during scraping:', err);
    } finally {
        await browser.close();
    }
}

main();
