require('dotenv').config({ path: '.env.local' });
const { Polar } = require('@polar-sh/sdk');

const accessToken = process.env.POLAR_ACCESS_TOKEN;
const targetCode = '58UXWXAT';

console.log('--- Polar Discount Debug Script ---');
const polar = new Polar({
    accessToken: accessToken,
    server: 'production',
});

async function run() {
    try {
        console.log('\n1. Fetching Discounts...');
        const discounts = await polar.discounts.list({ limit: 100 });

        const found = discounts.result.items.find(d => d.code === targetCode || d.name === targetCode);

        if (found) {
            console.log('✅ Discount FOUND!');
            console.log(JSON.stringify(found, null, 2));

            if (found.type === 'percentage') {
                console.log(`\n   Type: Percentage`);
                console.log(`   Value: ${found.basisPoints / 100}%`); // Polar uses basis points (10000 = 100%)
            }

            console.log(`   Organization ID: ${found.organizationId}`);
        } else {
            console.error('❌ Discount NOT FOUND in the list.');
            console.log('\n--- Available Discounts ---');
            discounts.result.items.forEach(d => {
                console.log(`- [${d.id}] ${d.name} (Code: ${d.code})`);
            });
        }

    } catch (error) {
        console.error('❌ API Error:', error.message);
    }
}

run();
