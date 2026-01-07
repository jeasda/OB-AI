'use client';

import { useState } from 'react';

type QueueStatusResponse = {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  outputUrl?: string;
  error?: string;
};

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

  const pollStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/queue/status?jobId=${jobId}`);
        if (!res.ok) throw new Error('Status fetch failed');

        const data = (await res.json()) as QueueStatusResponse;

        if (data.status === 'COMPLETED' && data.outputUrl) {
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
      } catch {
        clearInterval(interval);
        setLoading(false);
        setError('Polling failed');
      }
    }, 3000);
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
      const formData = new FormData();
      formData.append('file', sourceImage);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = (await uploadRes.json()) as {
        success: boolean;
        url?: string;
        error?: string;
      };

      if (!uploadData.success || !uploadData.url) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      const absoluteImageUrl = new URL(uploadData.url, window.location.origin).toString();

      setStatusMessage('Queuing job...');

      const queueRes = await fetch('/api/queue/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageUrl: absoluteImageUrl,
          aspectRatio,
          steps,
          cfg,
          negativePrompt,
        }),
      });

      const queueData = (await queueRes.json()) as {
        jobId: string;
        error?: string;
      };

      if (queueData.error) throw new Error(queueData.error);

      setStatusMessage('Waiting for GPU...');
      pollStatus(queueData.jobId);

    } catch (err: any) {
      setError(err.message || 'Unexpected error');
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen bg-[#0f0f0f] text-gray-200">
      <button
        onClick={generateImage}
        disabled={loading}
        className="m-auto px-6 py-3 bg-yellow-500 text-black rounded font-bold"
      >
        {loading ? statusMessage : 'Generate'}
      </button>

      {image && (
        <img src={image} alt="Generated" className="absolute bottom-10 right-10 max-w-md rounded" />
      )}

      {error && (
        <div className="absolute bottom-6 right-6 bg-red-600 text-white px-4 py-2 rounded">
          {error}
        </div>
      )}
    </main>
  );
}
