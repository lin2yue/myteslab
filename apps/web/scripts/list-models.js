const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const geminiApiKey = process.env.GEMINI_API_KEY;

async function listModels() {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + geminiApiKey;
    const response = await fetch(url);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

listModels();
