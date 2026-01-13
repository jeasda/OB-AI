// public/app.js

// CONFIG: API Base URL (Update this for production)
// If deployed to Pages, API is likely on a different subdomain.
// Example: https://ob-ai-api.jeasd.workers.dev
const API_BASE = "https://ob-ai-api.workers.dev";

const API_CREATE = `${API_BASE}/api/queue/create`;
const API_POLL = `${API_BASE}/api/runpod-poll`;
const API_STATUS = `${API_BASE}/api/queue/status`;

// Elements
const views = {
    create: document.getElementById('create-view'),
    processing: document.getElementById('processing-view'),
    result: document.getElementById('result-view'),
    error: document.getElementById('error-view')
};

const inputs = {
    prompt: document.getElementById('prompt'),
    ratio: document.getElementById('ratio'),
    generateBtn: document.getElementById('generate-btn')
};

const display = {
    progressBar: document.getElementById('progress-bar'),
    statusText: document.getElementById('status-text'),
    resultImg: document.getElementById('result-img'),
    resultPrompt: document.getElementById('result-prompt'),
    downloadBtn: document.getElementById('download-btn'),
    errorMsg: document.getElementById('error-msg')
};

const buttons = {
    reset: document.getElementById('reset-btn'),
    retry: document.getElementById('retry-btn')
};

// State
let currentJobId = null;
let pollInterval = null;
let progressValue = 0;
let progressInterval = null;

// --- Event Listeners ---
inputs.generateBtn.addEventListener('click', handleGenerate);
buttons.reset.addEventListener('click', resetUI);
buttons.retry.addEventListener('click', resetUI);

// --- Functions ---

function showView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

async function handleGenerate() {
    const prompt = inputs.prompt.value.trim();
    const ratio = inputs.ratio.value;

    if (!prompt) return alert("Please enter a prompt");
    if (prompt.length < 3) return alert("Prompt too short");

    // Reset State
    currentJobId = null;
    progressValue = 0;

    // UI Switch
    showView('processing');
    startProgressAnimation();
    updateStatus("Queuing job...");

    try {
        const res = await fetch(API_CREATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, ratio })
        });

        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Failed to create job");

        currentJobId = data.id;
        updateStatus("Job queued. Waiting for GPU...");

        // Start Polling
        startPolling();

    } catch (err) {
        showError(err.message);
    }
}

// "Illusion" Progress
function startProgressAnimation() {
    if (progressInterval) clearInterval(progressInterval);
    progressValue = 0;
    updateProgress(0);

    // 0-20% fast, 20-60% slow, 60-85% very slow
    progressInterval = setInterval(() => {
        if (progressValue < 20) {
            progressValue += 2;
        } else if (progressValue < 60) {
            progressValue += 0.5;
        } else if (progressValue < 90) {
            progressValue += 0.1;
        }
        // Cap at 90% until done
        if (progressValue > 95) progressValue = 95;

        updateProgress(progressValue);
    }, 200);
}

function updateProgress(percent) {
    display.progressBar.style.width = `${percent}%`;
}

function updateStatus(text) {
    display.statusText.innerText = text;
}

// Polling
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    // Poll immediately then every 5s
    checkStatus();
    pollInterval = setInterval(checkStatus, 5000);
}

async function checkStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(API_POLL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: currentJobId }) // Optional if PollAll, but handy if by Id
        });

        // Note: API_POLL (pollAllRunningJobs) checks ALL running jobs, triggers updates.
        // It returns { checked, updated: [...] }
        // We actually need to query the STATUS of OUR specific job.
        // Wait, the backend /dev/runpod-poll triggers the update in DB, but doesn't return *my* job status if it wasn't just updated.
        // We need a way to GET job status from DB. 
        // Usually: GET /api/job/:id or similar.
        // But for this V1, let's assume we might need to add a "Status Check" endpoint or 
        // if /dev/runpod-poll returns the updated list, we check if our ID is in there with status 'done'.

        // BUT! /dev/runpod-poll only returns jobs that *changed* status in that specific poll round. 
        // If Cron updated it 1 second ago, this manual poll might return nothing.

        // WORKAROUND Phase 4.1: "Call POST /runpod-poll".
        // Actually we probably need a GET /api/queue/:id endpoint to check status reliably.
        // Let's implement a quick client-side check logic.
        // For now, I will optimistically use a new endpoint (that I should create) OR 
        // try to rely on the poll response IF I modify the backend to return status for a specific ID.

        // DECISION: I will add `handleJobStatus` endpoint in backend in next step for reliable polling.
        // For now, let's write the code assuming `POST /api/queue/status` exists or consistent usage.

        // Let's try to stick to existing: The user requirement said "Phase 4.1... Call POST /api/runpod-poll".
        // Maybe they expect that endpoint to check just ONE job?
        // My implemented `handleRunpodPoll` checks *ALL* running jobs.
        // If I send `{ jobId }` to it, my current code *ignores* it and checks *ALL*.
        // And it returns `updated` array.

        // CRITICAL FIX: I should probably create a specific `GET /api/jobs/:id` endpoint.
        // FOR NOW in this `app.js`, I will assume `GET /api/jobs?id=...` or similar.
        // Wait, let's look at `index.ts`. I only have `/api/queue/create`, `/dev/runpod`, `/dev/runpod-poll`.
        // I MISS A STATUS CHECK ENDPOINT!

        // I will write this assuming `GET /api/queue/status?id={jobId}`. 
        // I will add this endpoint in the next step.

        const statusRes = await fetch(`${API_STATUS}?id=${currentJobId}`);
        if (statusRes.ok) {
            const statusData = await statusRes.json();
            // { ok: true, status: 'done', result_url: ... }

            if (statusData.status === 'done') {
                finishJob(statusData);
            } else if (statusData.status === 'error') {
                showError(statusData.error || "Job failed");
            } else {
                // running / queued
                updateStatus(`Status: ${statusData.status} (Running...)`);
            }
        }

    } catch (err) {
        console.warn("Poll warning:", err);
    }
}

function finishJob(data) {
    clearInterval(pollInterval);
    clearInterval(progressInterval);
    updateProgress(100);

    setTimeout(() => {
        display.resultImg.src = data.result_url;
        display.resultPrompt.innerText = inputs.prompt.value; // or data.prompt
        display.downloadBtn.href = data.result_url;

        showView('result');
    }, 500);
}

function showError(msg) {
    clearInterval(pollInterval);
    clearInterval(progressInterval);
    display.errorMsg.innerText = msg;
    showView('error');
}

function resetUI() {
    inputs.prompt.value = "";
    display.resultImg.src = "";
    showView('create');
}
