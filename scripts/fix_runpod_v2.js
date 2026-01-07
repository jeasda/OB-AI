
const https = require('https');

const API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = 'i3qcf6gz8v495h';
const TARGET_PATH = '/comfyui/models';

if (!API_KEY) {
    console.error("❌ Need RUNPOD_API_KEY env var");
    process.exit(1);
}

function gql(query, variables = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request('https://api.runpod.io/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.errors) reject(json.errors);
                    else resolve(json.data);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ query, variables }));
        req.end();
    });
}

async function run() {
    try {
        console.log("🔍 1. Fetching Network Volumes...");
        const vols = await gql(`
            query {
                myNetworkVolumes {
                    id
                    name
                    dataCenterId
                }
            }
        `);

        const myVol = vols.myNetworkVolumes.find(v => v.name.includes('comfy-models'));
        if (!myVol) {
            console.error("❌ Could not find volume 'comfy-models'. Available:", vols.myNetworkVolumes.map(v => v.name));
            process.exit(1);
        }
        console.log(`✅ Found Volume: ${myVol.name} (${myVol.id})`);

        console.log("📝 2. Updating Endpoint...");
        // Note: The field for path might be different, but let's try the standard input structure
        // If this fails, we might need to check current endpoint structure first

        const update = await gql(`
            mutation saveEndpoint($input: EndpointInput!) {
                saveEndpoint(input: $input) {
                    id
                    networkVolume {
                        id
                    }
                }
            }
        `, {
            input: {
                id: ENDPOINT_ID,
                networkVolumeId: myVol.id,
                // Some APIs use 'containerDiskSize' etc. 
                // For mount path, it's often implicit or a specific field.
                // Let's try to assume the API handles the path via env var OR we rely on default /runpod-volume
                // and we re-configure our code.
                // BUT wait, the UI allows custom path.
                // Let's try injecting it into environment variable if we can't find the field
            }
        });

        console.log("✅ Endpoint Updated!", update);
        console.log("⚠️ Note: RunPod GraphQL might not expose 'mountPath' easily here.");
        console.log("ℹ️ If the models are still not found, we will check /runpod-volume/" + myVol.id);

    } catch (e) {
        console.error("❌ Error:", JSON.stringify(e, null, 2));
    }
}

run();
