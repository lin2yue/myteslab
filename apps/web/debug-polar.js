require('dotenv').config({ path: '.env.local' });
const { Polar } = require('@polar-sh/sdk');

const accessToken = process.env.POLAR_ACCESS_TOKEN;
const targetProductId = '3f5b29c4-563f-4d37-91b0-584f58b9683a'; // Your Lite Pack ID

console.log('--- Polar Debug Script ---');
console.log('1. Checking Environment...');
if (!accessToken) {
    console.error('❌ POLAR_ACCESS_TOKEN is missing in .env.local');
    process.exit(1);
}
console.log('✅ Token found:', accessToken.substring(0, 10) + '...');

const polar = new Polar({
    accessToken: accessToken,
    server: 'production', // Testing production
});

async function run() {
    try {
        console.log('\n2. Listing Products...');
        // Try to list products (default pagination)
        const result = await polar.products.list({ limit: 100 });

        console.log(`✅ API Call Successful. Found ${result.result.items.length} products.`);

        console.log('\n3. Searching for Target Product:', targetProductId);
        const found = result.result.items.find(p => p.id === targetProductId);

        if (found) {
            console.log('✅ Product FOUND!');
            console.log(`   Name: ${found.name}`);
            console.log(`   ID: ${found.id}`);
            console.log(`   Organization ID: ${found.organizationId}`);
        } else {
            console.error('❌ Product NOT FOUND in the list.');
            console.log('\n--- Available Products (Top 5) ---');
            result.result.items.slice(0, 5).forEach(p => {
                console.log(`- [${p.id}] ${p.name} (Org: ${p.organizationId})`);
            });
        }

    } catch (error) {
        console.error('❌ API Error:', error.message);
        if (error.body) {
            console.error('   Details:', JSON.stringify(error.body, null, 2));
        }
    }
}

run();
