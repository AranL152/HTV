"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Waveform from '@/components/Waveform';
import WaveformModeToggle from '@/components/WaveformModeToggle';
import MetricsPanel from '@/components/MetricsPanel';
import LoadingSpinner from '@/components/LoadingSpinner';
import ClusterDetailModal from '@/components/ClusterDetailModal';
import Header from '@/components/Header';
import { WaveformData, WaveformMode } from '@/types';
import { apiClient } from '@/lib/api-client';

function VisualizeContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("id");
  const [data, setData] = useState<WaveformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [mode, setMode] = useState<WaveformMode>('count');

  useEffect(() => {
    if (!datasetId) {
      setError("No dataset ID provided");
      setLoading(false);
      return;
    }

    const fetchWaveform = async () => {
      try {
        const waveformData = await apiClient.getWaveform(datasetId);
        setData(waveformData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchWaveform();
  }, [datasetId]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !data || !datasetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 text-center">
          <p className="text-xl mb-4">{error || "No data available"}</p>
          <Link href="/" className="text-white hover:underline">
            ← Back to upload
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="pl-2 pr-4 py-4 sm:pl-3 sm:pr-6 sm:py-6 lg:pl-4 lg:pr-8 lg:py-8">
        <div className="max-w-full mx-auto space-y-4">
          <div className="flex justify-end">
            <Link
              href="/"
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              ← New dataset
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
            {/* Waveform */}
            <div className="relative">
              <div className="absolute top-4 left-4 z-10">
                <WaveformModeToggle mode={mode} onModeChange={setMode} />
              </div>
              <Waveform
                datasetId={datasetId}
                initialData={data}
                onDataUpdate={setData}
                onClusterClick={setSelectedClusterId}
                mode={mode}
              />
            </div>

            {/* Metrics Panel */}
            <MetricsPanel
              data={data}
              datasetId={datasetId}
              onSuggestionsReceived={setData}
              mode={mode}
            />
          </div>

          <ClusterDetailModal
            cluster={data.peaks.find((p) => p.id === selectedClusterId) || null}
            onClose={() => setSelectedClusterId(null)}
          />
        </div>
      </div>
    </div>
  );
}

export default function VisualizePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <VisualizeContent />
    </Suspense>
  );
}
