
const https = require('https');

// Configuration
const RUNPOD_ENDPOINT_ID = process.argv[2] || 'i3qcf6gz8v495h'; // Default from user input
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

if (!RUNPOD_API_KEY) {
    console.error('❌ Error: RUNPOD_API_KEY environment variable is not set.');
    process.exit(1);
}

const BASE_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;
console.log(`Checking RunPod Endpoint: ${BASE_URL}`);

async function checkHealth() {
    return new Promise((resolve, reject) => {
        const req = https.request(`${BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${RUNPOD_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ Endpoint Health Check Passed');
                    try {
                        const json = JSON.parse(data);
                        console.log('   Status:', JSON.stringify(json, null, 2));
                        resolve(json);
                    } catch (e) {
                        console.log('   (Non-JSON response)', data);
                        resolve(data);
                    }
                } else {
                    console.log(`❌ Endpoint Health Check Failed: Status ${res.statusCode}`);
                    console.log('   Response:', data);
                    resolve(null); // Resolve null to indicate failure but not crash
                }
            });
        });
        req.on('error', (e) => {
            console.error('Network Error:', e.message);
            reject(e);
        });
        req.end();
    });
}

async function main() {
    console.log('--- Starting Verification ---');
    await checkHealth();
    console.log('-----------------------------');
    console.log('To fully verify models (Qwen etc.), we need to run a test generation workflow.');
    console.log('The health check confirms the container is running and accessible.');
}

main();
