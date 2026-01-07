
const https = require('https');

const API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = 'i3qcf6gz8v495h';
const JOB_ID = process.argv[2];

if (!JOB_ID) {
    console.error('Usage: node check_job_status.js <JOB_ID>');
    process.exit(1);
}

const url = `https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${JOB_ID}`;

function checkStatus() {
    const options = {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    https.get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                console.log(`Status: ${json.status}`);
                if (json.status === 'COMPLETED') {
                    console.log('✅ Job Failed or Completed!');
                    console.log('Output:', JSON.stringify(json.output, null, 2));
                    process.exit(0);
                } else if (json.status === 'FAILED') {
                    console.log('❌ Job Failed!');
                    console.log('Error:', JSON.stringify(json.error, null, 2));
                    process.exit(1);
                } else {
                    console.log('Still running... waiting 5s');
                    setTimeout(checkStatus, 5000);
                }
            } catch (e) {
                console.error('Error parsing response:', e);
            }
        });
    }).on('error', (e) => {
        console.error('Request error:', e);
    });
}

console.log(`Polling status for job: ${JOB_ID}`);
checkStatus();
