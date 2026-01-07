
const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 8188,
    path: '/object_info/CheckpointLoaderSimple',
    method: 'GET',
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Available Checkpoints:', JSON.stringify(json.CheckpointLoaderSimple.input.required.ckpt_name[0], null, 2));
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
});

req.on('error', (e) => {
    console.error('Problem with request:', e.message);
});

req.end();
