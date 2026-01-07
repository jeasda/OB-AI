
const https = require('https');

const API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = 'i3qcf6gz8v495h';

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
        console.log("🔍 Fetching Network Volumes...");
        // Try 'networkVolumes'
        const data = await gql(`
            query {
                networkVolumes {
                    id
                    name
                    dataCenterId
                }
            }
        `);

        const myVol = data.networkVolumes.find(v => v.name.includes('comfy-models'));
        if (!myVol) {
            console.error("❌ Volume not found.");
            process.exit(1);
        }

        console.log(`✅ Volume ID: ${myVol.id}`);

        console.log("📝 Updating Endpoint...");
        const result = await gql(`
            mutation saveEndpoint($input: EndpointInput!) {
                saveEndpoint(input: $input) {
                    id
                }
            }
        `, {
            input: {
                id: ENDPOINT_ID,
                networkVolumeId: myVol.id,
                // Try passing dockerArgs to force a mount if specific field missing? 
                // Or maybe the input has a specific field for mount path.
                // Based on docs, it's elusive. 
                // BUT, if we just link the volume, it usually mounts to /runpod-volume/{id}
                // We will print the ID so the user can use it if needed.
            }
        });
        console.log("✅ Managed to Link Volume via API.");
        console.log(`ℹ️ The Volume should be at: /runpod-volume/${myVol.id}`);
        console.log(`ℹ️ Expecting models at: /runpod-volume/${myVol.id}/ComfyUI/models`);

    } catch (e) {
        console.error("❌ Error:", JSON.stringify(e, null, 2));
    }
}

run();
