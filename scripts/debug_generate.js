
const fs = require('fs');

async function testGeneration() {
    console.log('Sending request...');
    try {
        const res = await fetch('http://localhost:3000/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: 'debug test',
                aspectRatio: '1:1',
                steps: 5, // Low steps for speed
                cfg: 8
            })
        });

        console.log('Status:', res.status);
        console.log('Content-Type:', res.headers.get('content-type'));

        const buffer = await res.arrayBuffer();
        console.log('Bytes received:', buffer.byteLength);

        if (res.ok) {
            fs.writeFileSync('debug_output.png', Buffer.from(buffer));
            console.log('Saved debug_output.png');
            // Log first few bytes to check for PNG signature
            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            const header = Buffer.from(buffer).slice(0, 16);
            console.log('Header bytes:', header.toString('hex'));
        } else {
            console.log('Error body:', Buffer.from(buffer).toString());
        }

    } catch (e) {
        console.error(e);
    }
}

testGeneration();
