
const https = require('https');

// HARDCODE CREDENTIALS FOR TESTING (DO NOT COMMIT)
// User provided endpoint ID in chat
const API_KEY = process.env.RUNPOD_API_KEY || "YOUR_API_KEY"; // User must provide this env var
const ENDPOINT_ID = "i3qcf6gz8v495h";

async function submitJob() {
    const url = `https://api.runpod.ai/v2/${ENDPOINT_ID}/run`;

    const input = {
        prompt: "A beautiful scenery",
        model: "qwen-image",
        jobId: "test-local-" + Date.now(),
        ratio: "1:1",
        image_url: "https://cdn.obaistudio.com/uploads/2026/01/test.png",
        image: "https://cdn.obaistudio.com/uploads/2026/01/test.png"
    };

    const payload = JSON.stringify({ input });
    console.log("Payload:", payload);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        }
    };

    const req = https.request(url, options, (res) => {
        let data = '';
        console.log(`Status Code: ${res.statusCode}`);

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('Body:', data);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

if (!process.env.RUNPOD_API_KEY) {
    console.error("Please set RUNPOD_API_KEY env var");
    process.exit(1);
}

submitJob();
