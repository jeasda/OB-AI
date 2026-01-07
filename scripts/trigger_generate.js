
async function triggerGenerate() {
    try {
        console.log('Triggering generation...');
        const response = await fetch('http://localhost:3000/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: 'debug test script',
                aspectRatio: '1:1',
                steps: 20,
                cfg: 8
            })
        });

        console.log('Status:', response.status);
        if (!response.ok) {
            const text = await response.text();
            console.log('Error:', text);
        } else {
            // It might be a binary image, just log success
            console.log('Success: Image received (binary data)');
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

triggerGenerate();
