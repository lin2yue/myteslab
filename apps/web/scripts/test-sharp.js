import sharp from 'sharp';
import { writeFile } from 'fs/promises';

async function testSharp() {
    console.log('Testing Sharp...');
    try {
        const buffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 }
            }
        }).png().toBuffer();

        await writeFile('test-sharp.png', buffer);
        console.log('✅ Sharp test successful! Created test-sharp.png');
    } catch (err) {
        console.error('❌ Sharp test failed:', err);
    }
}

testSharp();
