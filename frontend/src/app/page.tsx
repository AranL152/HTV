'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Automatically upload after selection
    setUploading(true);
    try {
      const data = await apiClient.uploadFile(selectedFile);
      router.push(`/visualize?id=${data.dataset_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-8 overflow-hidden bg-black">
      {/* Angled wireframe grid background with circular orbit animation */}
      <div className="absolute inset-0 pointer-events-none opacity-40 animate-grid-orbit-circular">
        {/* Horizontal lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(to bottom, transparent 0%, transparent calc(100% - 1px), rgba(255, 255, 255, 0.3) calc(100% - 1px))',
          backgroundSize: '100% 80px'
        }} />
        {/* Vertical lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(to right, transparent 0%, transparent calc(100% - 1px), rgba(255, 255, 255, 0.3) calc(100% - 1px))',
          backgroundSize: '80px 100%'
        }} />
      </div>
      
      {/* Connecting lines with glow effect */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(255, 255, 255)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(255, 255, 255)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgb(255, 255, 255)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="15%" y1="20%" x2="80%" y2="30%" stroke="url(#lineGradient1)" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite" />
        </line>
        <line x1="25%" y1="75%" x2="85%" y2="65%" stroke="url(#lineGradient1)" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite" />
        </line>
        <line x1="10%" y1="50%" x2="70%" y2="60%" stroke="url(#lineGradient1)" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.2;0.6;0.2" dur="4s" repeatCount="indefinite" />
        </line>
      </svg>
      
      <main className="relative z-10 flex flex-col items-center gap-6 max-w-4xl w-full">
        <div className="text-center space-y-0">
          {/* Main headline with gradient - Extra large */}
          <h1 className="text-9xl md:text-[12rem] font-medium tracking-wide leading-tight text-white">
            level
          </h1>
          
          {/* Subtitle - Smaller */}
          <p className="text-lg md:text-xl text-white max-w-2xl mx-auto -mt-4">
            visualize, detect, and balance bias.
          </p>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col items-center gap-6 group">
          <button
            onClick={triggerFileSelect}
            disabled={uploading}
            className="relative px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          >
            <span className="flex items-center gap-2">
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  analyzing...
                </>
              ) : (
                <>
                  analyze dataset
                  <svg 
                    className="w-5 h-5 group-hover:translate-x-1 transition-transform" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </span>
          </button>

          {/* Status messages */}
          {file && !error && !uploading && (
            <p className="text-sm text-green-400">
              Selected: {file.name}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </main>
    </div>
  );
}
