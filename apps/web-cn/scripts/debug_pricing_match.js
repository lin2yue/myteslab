// Copied from apps/web-cn/src/lib/constants/credits.ts
const PRICING_TIERS_BASE = [
    {
        id: 'starter',
        nameKey: 'starter',
        price: '19.9',
        credits: 60,
        polarProductId: '',
    },
    {
        id: 'explorer',
        nameKey: 'explorer',
        price: '59.0',
        credits: 200,
        savings: '10',
        polarProductId: '',
    },
    {
        id: 'advanced',
        nameKey: 'advanced',
        price: '128.0',
        credits: 500,
        popular: true,
        savings: '20',
        polarProductId: '',
    },
    {
        id: 'collector',
        nameKey: 'collector',
        price: '288.0',
        credits: 1200,
        savings: '30',
        polarProductId: '',
    }
];

// Payload amount from logs
const totalAmount = "19.90";

function testMatch() {
    console.log(`Testing match for totalAmount: "${totalAmount}"`);

    const paidAmount = parseFloat(totalAmount);
    console.log(`Parsed paidAmount: ${paidAmount}`);

    // Logic from route.ts
    const matchedTier = PRICING_TIERS_BASE.find(t => {
        const price = parseFloat(t.price);
        const diff = Math.abs(price - paidAmount);
        const isMatch = diff < 0.01;
        console.log(`Checking Tier ${t.id}: price="${t.price}", parsed=${price}, diff=${diff}, match=${isMatch}`);
        return isMatch;
    });

    if (matchedTier) {
        console.log(`SUCCESS: Matched tier ${matchedTier.id}`);
    } else {
        console.error('FAILURE: No tier matched.');
    }
}

testMatch();
