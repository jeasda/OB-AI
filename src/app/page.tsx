
'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [steps, setSteps] = useState('4');
  const [cfg, setCfg] = useState(2.5);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceImage(file);
      setSourceImagePreview(URL.createObjectURL(file));
    }
  };

  const pollStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/queue/status?jobId=${jobId}`);
        const data = await res.json();

        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          setImage(data.outputUrl);
          setLoading(false);
          setStatusMessage('Done!');
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          setLoading(false);
          setError(data.error || 'Generation failed');
        } else {
          setStatusMessage(`Status: ${data.status}...`);
        }
      } catch (e) {
        clearInterval(interval);
        setLoading(false);
        setError('Polling failed');
      }
    }, 3000); // Check every 3 seconds
  };

  const generateImage = async () => {
    if (!prompt) return;
    if (!sourceImage) {
      setError('Please upload a source image');
      return;
    }

    setLoading(true);
    setError(null);
    setImage(null);
    setStatusMessage('Uploading image...');

    try {
      // 1. Upload Image to R2
      const formData = new FormData();
      formData.append('file', sourceImage);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      const r2Url = uploadData.url; // Relative URL /api/image/...

      // NOTE: RunPod needs a publicly accessible URL. 
      // If /api/image/key is protected or localhost during dev, RunPod fails.
      // In Production (Cloudflare Pages), this URL will be https://your-domain.com/api/image/key
      // For now, let's proceed assuming standard flow.

      // We need the FULL URL if we are running locally? 
      // Actually, if we are passing this to RunPod, RunPod needs to reach it.
      // A relative URL won't work for RunPod.
      // We will need to construct the absolute URL in the backend or here.
      // Let's rely on the Backend to construct "Real Public URL" or R2 Presigned URL if possible.
      // For this implementation, let's assume the Backend returns something usable or we construct it.
      // Temporary Hack: In real prod, use window.location.origin
      const absoluteImageUrl = new URL(r2Url, window.location.href).toString();

      setStatusMessage('Queuing job...');

      // 2. Create Job
      const queueRes = await fetch('/api/queue/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageUrl: absoluteImageUrl,
          // Note: If running on localhost, RunPod CANNOT reach this.
          // You MUST use a public URL (e.g. from an existing R2 bucket publicly accessible)
          // or use ngrok for localhost testing.
        }),
      });

      const queueData = await queueRes.json();
      if (queueData.error) throw new Error(queueData.error);

      setStatusMessage('Waiting for GPU...');

      // 3. Poll Status
      pollStatus(queueData.jobId);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen bg-[#0f0f0f] text-gray-200 overflow-hidden font-sans">
      {/* Sidebar / Left Panel */}
      <div className="w-80 bg-[#18181b] border-r border-gray-800 flex flex-col p-4 gap-6 z-20 shadow-xl overflow-y-auto">
        <div className="flex items-center gap-2 px-2 py-4 justify-center">
          {/* Logo Placeholder */}
          <div className="text-xl font-bold tracking-tighter text-yellow-500">RUNNINGHUB</div>
        </div>

        <div className="space-y-6 pr-2">
          {/* Image Upload Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Source Image</label>
            <div className="relative w-full aspect-square bg-[#27272a] border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500 transition-colors overflow-hidden group">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleImageUpload}
              />
              {sourceImagePreview ? (
                <div className="relative w-full h-full">
                  <img src={sourceImagePreview} alt="Source" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-white">Change Image</span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4">
                  <svg className="w-8 h-8 mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <span className="text-xs text-gray-500">Click to upload</span>
                </div>
              )}
            </div>
          </div>

          {/* Parameters Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prompt</label>
            <textarea
              className="w-full h-32 bg-[#27272a] border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-colors resize-none placeholder-gray-600"
              placeholder="Describe your edit..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aspect Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full bg-[#27272a] border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-colors cursor-pointer"
            >
              <option value="1:1">1:1 (Square)</option>
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Portrait)</option>
            </select>
          </div>

          <button
            onClick={generateImage}
            disabled={loading || !prompt || !sourceImage}
            className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-all ${loading || !prompt || !sourceImage
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg hover:shadow-yellow-500/20'
              }`}
          >
            {loading ? statusMessage : 'Generate Edit'}
          </button>
        </div>
      </div>

      {/* Main Content / Canvas */}
      <div className="flex-1 relative flex flex-col">
        {/* Top Bar */}
        <header className="h-14 bg-[#18181b] border-b border-gray-800 flex items-center justify-between px-6">
          <div className="text-sm text-gray-500">Workspace / <span className="text-gray-200">Qwen Image Edit</span></div>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-600">
            <span>RUNPOD: CONNECTED</span>
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 p-8 flex items-center justify-center bg-center relative group" style={{ backgroundImage: "url('/grid.svg')" }}>

          {/* Background pattern placeholder */}
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          {!image ? (
            <div className="text-center space-y-4 max-w-md">
              <div className="w-24 h-24 bg-gray-800 rounded-full mx-auto flex items-center justify-center text-gray-600">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </div>
              <p className="text-gray-500 text-sm">Upload an image and enter a prompt to start editing.</p>
            </div>
          ) : (
            <div className="relative group/image">
              <img
                src={image}
                alt="Generated"
                className="max-h-[80vh] max-w-full rounded-lg shadow-2xl border border-gray-800"
              />
              <a
                href={image}
                download
                className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover/image:opacity-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </a>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-yellow-500 font-mono text-sm animate-pulse">{statusMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-6 right-6 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-300">×</button>
        </div>
      )}
    </main>
  );
}
