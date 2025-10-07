"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import AnimatedScene from "@/components/AnimatedScene";
import Header from "@/components/Header";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
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
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSampleDataset = async () => {
    setUploading(true);
    setError(null);

    try {
      const data = await apiClient.uploadSampleDataset();
      router.push(`/visualize?id=${data.dataset_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sample dataset");
      setUploading(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-black">
      <Header />
      {/* Three.js Animated Height Map Background */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatedScene />

        {/* Noise background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.8) 100%)",
          }}
        />

        {/* Bottom vignette */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Connecting lines with glow effect */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(255, 255, 255)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(255, 255, 255)" stopOpacity="1" />
            <stop
              offset="100%"
              stopColor="rgb(255, 255, 255)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <line
          x1="15%"
          y1="20%"
          x2="80%"
          y2="30%"
          stroke="url(#lineGradient1)"
          strokeWidth="1"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.2;0.6;0.2"
            dur="3s"
            repeatCount="indefinite"
          />
        </line>
        <line
          x1="25%"
          y1="75%"
          x2="85%"
          y2="65%"
          stroke="url(#lineGradient1)"
          strokeWidth="1"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.6;0.2;0.6"
            dur="3s"
            repeatCount="indefinite"
          />
        </line>
        <line
          x1="10%"
          y1="50%"
          x2="70%"
          y2="60%"
          stroke="url(#lineGradient1)"
          strokeWidth="1"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.2;0.6;0.2"
            dur="4s"
            repeatCount="indefinite"
          />
        </line>
      </svg>

      <main className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-1 flex flex-col items-center justify-center gap-6 max-w-md">
        <div className="text-center space-y-0">
          {/* Main headline with gradient - Extra large */}
          <h1
            className="text-9xl md:text-[12rem] font-medium tracking-wide leading-tight"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #e5e5e5 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            level
          </h1>

          {/* Subtitle - Smaller */}
          <p
            className="text-lg md:text-xl max-w-2xl mx-auto -mt-4"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #d1d1d1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            visualize, detect, and balance bias.
          </p>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col items-center gap-6 group">
          <div className="relative flex items-center justify-center min-h-[60px]">
            {uploading ? (
              <LoadingSpinner />
            ) : (
              <>
                <button
                  onClick={triggerFileSelect}
                  className="relative px-5 py-2.5 text-black text-sm font-medium rounded-lg transition-all duration-300"
                >
                  <span className="bg-white py-3 px-4 rounded-xl text-black">
                    get started
                  </span>
                </button>

                <button
                  onClick={handleSampleDataset}
                  className="relative px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-all duration-300"
                >
                  <span className="border border-white/30 py-3 px-4 rounded-xl text-white hover:bg-white/10 transition-colors">
                    try sample
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Status messages */}
          {file && !error && !uploading && (
            <p
              className="text-sm"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Selected: {file.name}
            </p>
          )}
          {error && (
            <p
              className="text-sm"
              style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
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
