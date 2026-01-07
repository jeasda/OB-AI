
const https = require('https');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = 'i3qcf6gz8v495h';
const BASE_URL = `https://api.runpod.ai/v2/${ENDPOINT_ID}`;

if (!RUNPOD_API_KEY) {
    console.error('❌ Error: RUNPOD_API_KEY not set.');
    process.exit(1);
}

// Minimal Qwen Workflow for testing
// We will use a simplified payload if possible, or the full template.
// Ideally, for a quick test, we should use a known-good simple workflow if the full one is complex.
// But let's try to load the actual project template to verify it really works.

const workflowPath = path.join(__dirname, '../src/lib/workflow_template.json');
let workflow;
try {
    const raw = fs.readFileSync(workflowPath, 'utf8');
    workflow = JSON.parse(raw);
} catch (e) {
    console.error('❌ Failed to load workflow template:', e.message);
    process.exit(1);
}

// Helper to encode image
function encodeImage(filePath) {
    try {
        const fileData = fs.readFileSync(filePath);
        return Buffer.from(fileData).toString('base64');
    } catch (e) {
        console.error('❌ Error reading image:', e.message);
        return null;
    }
}

// Use one of the user uploaded images or a dummy one
// We'll try to find one in the artifacts dir or just use a small placeholder
const artifactDir = 'C:/Users/jeasd/.gemini/antigravity/brain/88488e0f-a958-426b-921d-21be1099206c';
// Pick any png file
const files = fs.readdirSync(artifactDir).filter(f => f.endsWith('.png'));
const imagePath = files.length > 0 ? path.join(artifactDir, files[files.length - 1]) : null;

let base64Image = '';
const targetFileName = 'test_input.png';

if (imagePath) {
    console.log(`Using input image: ${imagePath}`);
    base64Image = encodeImage(imagePath);
} else {
    console.error('❌ No PNG found for testing. Using dummy.');
    // Small 1x1 base64 png
    base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwftQAAAABJRU5ErkJggg==';
}

// PATCH WORKFLOW: Point all LoadImage nodes to 'test_input.png'
for (const nodeId in workflow) {
    const node = workflow[nodeId];
    if (node.class_type === 'LoadImage') {
        if (node.inputs && node.inputs.image) {
            console.log(`Patching node ${nodeId} (${node.class_type}) to use ${targetFileName}`);
            node.inputs.image = targetFileName;
        }
    }
}

const payload = {
    "input": {
        "workflow": workflow,
        "images": [
            {
                "name": targetFileName,
                "image": base64Image
            }
        ]
    }
};

console.log('Sending Job to RunPod (with Image Payload)...');

const req = https.request(`${BASE_URL}/runsync`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            console.log('Response:', JSON.stringify(json, null, 2));

            if (json.status === 'COMPLETED') {
                console.log('✅ Job Completed Successfully!');
                if (json.output) {
                    console.log('Output:', json.output);
                }
            } else if (json.status === 'FAILED') {
                console.log('❌ Job Failed:', json.error);
            } else {
                console.log('Job Status:', json.status);
            }
        } catch (e) {
            console.log('Raw Response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('Request Error:', e);
});

req.write(JSON.stringify(payload));
req.end();
