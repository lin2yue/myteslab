const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const BASE_URL = 'https://tesla-wrap.design';
const MODEL_KEY_HEX = 'f7f494e30ca0b33f1d90472d6b82d7ecee2662d9030284462066565e91795752';
const OUTPUT_DIR = path.resolve(__dirname, '../uploads/catalog_decrypted');

const MODELS = {
    model3: {
        body: "/models-encrypted/Model3_High/Model3_High.twm",
        wheels: "/models-encrypted/shared/Wheel_Stiletto_Silver.twm"
    },
    "model3-2024-base": {
        body: "/models-encrypted/model3-2024-base/model3-2024-base.twm",
        wheels: "/models-encrypted/shared/Wheel_Induction.twm"
    },
    "model3-2024-performance": {
        body: "/models-encrypted/model3-2024-performance/model3-2024-performance.twm",
        wheels: "/models-encrypted/shared/Wheel_Stiletto_Silver.twm"
    },
    modely: {
        body: "/models-encrypted/ModelY_High/ModelY_High.twm",
        wheels: "/models-encrypted/shared/Wheel_Induction.twm"
    },
    "modely-2025-premium": {
        body: "/models-encrypted/ModelY-2025-premium/ModelY-2025-premium.twm",
        wheels: "/models-encrypted/shared/Wheel_Induction.twm"
    },
    "modely-2025-performance": {
        body: "/models-encrypted/modely-2025-performance/modely-2025-performance.twm",
        wheels: "/models-encrypted/shared/Wheel_Induction.twm"
    },
    cybertruck: {
        body: "/models-encrypted/Cybertruck/Cybertruck.twm",
        wheels: "/models-encrypted/Cybertruck/Wheel_Cybertruck_Premium.twm"
    },
    "modely-2025-base": {
        body: "/models-encrypted/ModelY-2025-base/ModelY-2025-base.twm",
        wheels: "/models-encrypted/shared/Wheel_Induction.twm"
    },
    "modely-l": {
        body: "/models-encrypted/ModelY-L/ModelY-L.twm",
        wheels: "/models-encrypted/ModelY-L/Wheel_Machina.twm"
    },
    "shared_wheels_induction": {
        body: "/models-encrypted/shared/Wheel_Induction.twm"
    },
    "shared_wheels_stiletto": {
        body: "/models-encrypted/shared/Wheel_Stiletto_Silver.twm"
    }
};

async function downloadFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
                return;
            }
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

function decryptTwm(buffer, keyHex) {
    const key = Buffer.from(keyHex, 'hex');
    const iv = buffer.slice(0, 16);
    const tag = buffer.slice(16, 32);
    const ciphertext = buffer.slice(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('🚀 Starting model download and decryption...');

    for (const [modelId, paths] of Object.entries(MODELS)) {
        console.log(`\n📦 Processing ${modelId}...`);

        const modelSubDir = path.join(OUTPUT_DIR, modelId);
        if (!fs.existsSync(modelSubDir)) {
            fs.mkdirSync(modelSubDir, { recursive: true });
        }

        // Process body
        try {
            const bodyUrl = BASE_URL + paths.body;
            console.log(`  Downloading body: ${paths.body}`);
            const encryptedBody = await downloadFile(bodyUrl);
            const decryptedBody = decryptTwm(encryptedBody, MODEL_KEY_HEX);
            fs.writeFileSync(path.join(modelSubDir, 'body.glb'), decryptedBody);
            console.log(`  ✅ Decrypted body saved to ${modelId}/body.glb`);
        } catch (err) {
            console.error(`  ❌ Failed to process body for ${modelId}:`, err.message);
        }

        // Process wheels if present
        if (paths.wheels) {
            try {
                const wheelsUrl = BASE_URL + paths.wheels;
                console.log(`  Downloading wheels: ${paths.wheels}`);
                const encryptedWheels = await downloadFile(wheelsUrl);
                const decryptedWheels = decryptTwm(encryptedWheels, MODEL_KEY_HEX);
                fs.writeFileSync(path.join(modelSubDir, 'wheels.glb'), decryptedWheels);
                console.log(`  ✅ Decrypted wheels saved to ${modelId}/wheels.glb`);
            } catch (err) {
                console.error(`  ❌ Failed to process wheels for ${modelId}:`, err.message);
            }
        }
    }

    console.log('\n✨ All tasks completed!');
}

main().catch(console.error);
