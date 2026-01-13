// public/app.js (Frontend v2)

// CONFIG: API Base URL
// Example: https://ob-ai-api.workers.dev
const API_BASE = "https://ob-ai-api.legacy-project.workers.dev";

const API_CREATE = `${API_BASE}/api/queue/create`;
const API_STATUS = `${API_BASE}/api/queue/status`;

// Elements
const views = {
    empty: document.getElementById('view-empty'),
    processing: document.getElementById('view-processing'),
    result: document.getElementById('view-result'),
    error: document.getElementById('view-error')
};

const inputs = {
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    previewImg: document.getElementById('preview-img'),
    prompt: document.getElementById('prompt'),
    ratio: document.getElementById('ratio'),
    generateBtn: document.getElementById('generate-btn')
};

const display = {
    progressBar: document.getElementById('progress-bar'),
    statusMain: document.getElementById('status-main'),
    statusDetail: document.getElementById('status-detail'),
    resultImg: document.getElementById('result-img'),
    downloadBtn: document.getElementById('download-btn'),
    errorMsg: document.getElementById('error-msg')
};

const buttons = {
    reset: document.getElementById('reset-btn'),
    retry: document.getElementById('retry-btn')
};

// State
let selectedFile = null;
let currentJobId = null;
let pollInterval = null;
let progressValue = 0;
let progressInterval = null;

// Messages (Thai)
const STATUS_MESSAGES = {
    uploading: { main: "กำลังส่งภาพเข้าระบบ", detail: "กรุณารอสักครู่..." },
    queued: { main: "ได้คิวแล้ว!", detail: "ระบบกำลังเตรียม GPU ให้คุณ" },
    processing: { main: "AI กำลังทำงาน", detail: "กำลังแก้ไขภาพตามคำสั่ง..." },
    finalizing: { main: "เกือบเสร็จแล้ว", detail: "กำลังส่งภาพกลับมาให้คุณ..." }
};

// --- Event Listeners ---

// Drag & Drop
inputs.dropZone.addEventListener('click', () => inputs.fileInput.click());
inputs.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); inputs.dropZone.classList.add('dragover'); });
inputs.dropZone.addEventListener('dragleave', () => inputs.dropZone.classList.remove('dragover'));
inputs.dropZone.addEventListener('drop', handleDrop);
inputs.fileInput.addEventListener('change', handleFileSelect);

// Form
inputs.generateBtn.addEventListener('click', handleGenerate);
inputs.prompt.addEventListener('input', validateForm);

// Reset/Retry
buttons.reset.addEventListener('click', resetUI);
buttons.retry.addEventListener('click', resetUI);

// --- Functions ---

function handleDrop(e) {
    e.preventDefault();
    inputs.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        processFile(e.dataTransfer.files[0]);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length) {
        processFile(e.target.files[0]);
    }
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        alert("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (JPG/PNG)");
        return;
    }
    // Size check (optional/ 10MB limit implied)
    if (file.size > 10 * 1024 * 1024) {
        alert("ขนาดไฟล์ใหญ่เกิน 10MB");
        return;
    }

    selectedFile = file;

    // Show Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        inputs.previewImg.src = e.target.result;
        inputs.previewImg.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    validateForm();
}

function validateForm() {
    const hasImage = !!selectedFile;
    const hasPrompt = inputs.prompt.value.length > 0;

    if (hasImage) {
        inputs.generateBtn.disabled = false;
        // Prompt is required per PRD, but maybe we allow image-only triggers? PRD says Prompt Required.
        // inputs.generateBtn.disabled = !hasPrompt; 
    } else {
        inputs.generateBtn.disabled = true;
    }
}

function showView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

async function handleGenerate() {
    const prompt = inputs.prompt.value.trim();
    if (!prompt) return alert("กรุณาใส่คำสั่ง (Prompt)");

    // Reset State
    currentJobId = null;
    progressValue = 0;

    // UI Switch
    showView('processing');
    startProgressAnimation();
    updateStatus(STATUS_MESSAGES.uploading);

    try {
        // Construct FormData for Multipart Upload
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("ratio", inputs.ratio.value);
        formData.append("model", "qwen-image"); // Explicit model
        formData.append("image", selectedFile); // The file object

        const res = await fetch(API_CREATE, {
            method: "POST",
            body: formData
            // Note: Do NOT set Content-Type header manually for FormData, browser does it with boundary
        });

        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Failed to create job");

        currentJobId = data.id;
        updateStatus(STATUS_MESSAGES.queued);

        // Start Polling
        startPolling();

    } catch (err) {
        showError(err.message);
    }
}

// "Illusion" Progress (Thai Logic)
function startProgressAnimation() {
    if (progressInterval) clearInterval(progressInterval);
    progressValue = 0;
    updateProgress(0);

    // 0-60% Fast, 60-90% Slow, 90-99% Crawl
    progressInterval = setInterval(() => {
        if (progressValue < 60) {
            progressValue += 1.5; // Fast
        } else if (progressValue < 90) {
            progressValue += 0.4; // Slow
            updateStatus(STATUS_MESSAGES.processing);
        } else if (progressValue < 99) {
            progressValue += 0.05; // Crawl
            updateStatus(STATUS_MESSAGES.finalizing);
        }

        if (progressValue > 99) progressValue = 99;

        updateProgress(progressValue);
    }, 200);
}

function updateProgress(percent) {
    display.progressBar.style.width = `${percent}%`;
}

function updateStatus(msgObj) {
    if (msgObj.main) display.statusMain.innerText = msgObj.main;
    if (msgObj.detail) display.statusDetail.innerText = msgObj.detail;
}

// Polling
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    checkStatus();
    pollInterval = setInterval(checkStatus, 5000);
}

async function checkStatus() {
    if (!currentJobId) return;

    try {
        const statusRes = await fetch(`${API_STATUS}?id=${currentJobId}`);
        if (statusRes.ok) {
            const statusData = await statusRes.json();

            if (statusData.status === 'done') {
                finishJob(statusData);
            } else if (statusData.status === 'error') {
                showError(statusData.error || "Job failed");
            } else {
                // still running
                console.log("Status:", statusData.status);
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
    updateStatus({ main: "เสร็จเรียบร้อย!", detail: "กำลังแสดงผล..." });

    setTimeout(() => {
        display.resultImg.src = data.result_url;
        display.downloadBtn.href = data.result_url;
        showView('result');
    }, 800);
}

function showError(msg) {
    clearInterval(pollInterval);
    clearInterval(progressInterval);
    display.errorMsg.innerText = msg;
    showView('error');
}

function resetUI() {
    // Keep prompt maybe?
    // inputs.prompt.value = ""; 
    // Clear styles
    inputs.generateBtn.disabled = !selectedFile; // Re-check
    showView('empty');
}
