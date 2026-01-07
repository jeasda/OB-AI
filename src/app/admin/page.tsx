'use client';

import { useState, useEffect } from 'react';

export default function AdminPage() {
    const [url, setUrl] = useState('');
    const [pin, setPin] = useState('');
    const [status, setStatus] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');

    useEffect(() => {
        // Fetch current URL on load
        fetch('/api/config')
            .then(res => res.json())
            .then((data: any) => {
  if (data?.url) setCurrentUrl(data.url);
})

            .catch(err => console.error(err));
    }, []);

    const handleSave = async () => {
        setStatus('Saving...');
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, pin })
            });

            if (res.ok) {
                setStatus('Saved! You can now use the app.');
                setCurrentUrl(url);
            } else {
                const err = await res.text();
                setStatus('Error: ' + err);
            }
        } catch (e: any) {
            setStatus('Error: ' + e.message);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-900 p-8 rounded-xl border border-gray-800 space-y-6">
                <h1 className="text-2xl font-bold text-yellow-500">Admin Configuration</h1>

                <div className="p-4 bg-gray-800 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Current Active Tunnel:</p>
                    <p className="font-mono text-green-400 break-all">{currentUrl || 'Not set'}</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-300">New Tunnel URL</label>
                    <input
                        type="text"
                        className="w-full bg-black border border-gray-700 rounded p-3 text-sm focus:border-yellow-500 outline-none"
                        placeholder="https://xxxx.trycloudflare.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-300">Admin PIN</label>
                    <input
                        type="password"
                        className="w-full bg-black border border-gray-700 rounded p-3 text-sm focus:border-yellow-500 outline-none"
                        placeholder="Enter PIN"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                    />
                </div>

                <button
                    onClick={handleSave}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded transition-colors"
                >
                    Update System
                </button>

                {status && (
                    <p className={`text-center text-sm ${status.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                        {status}
                    </p>
                )}
            </div>
        </div>
    );
}
