'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Waveform from '@/components/Waveform';
import MetricsPanel from '@/components/MetricsPanel';
import LoadingSpinner from '@/components/LoadingSpinner';
import { WaveformData } from '@/types';
import { apiClient } from '@/lib/api-client';

function VisualizeContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get('id');
  const [data, setData] = useState<WaveformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) {
      setError('No dataset ID provided');
      setLoading(false);
      return;
    }

    const fetchWaveform = async () => {
      try {
        const waveformData = await apiClient.getWaveform(datasetId);
        setData(waveformData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
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
          <p className="text-xl mb-4">{error || 'No data available'}</p>
          <Link href="/" className="text-white hover:underline">
            ← Back to upload
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-full mx-auto space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dataset Visualization</h1>
            <p className="text-white/60 mt-2 text-sm sm:text-base">
              Drag peaks up or down to adjust cluster weights
            </p>
          </div>
          <Link
            href="/"
            className="text-white/60 hover:text-white transition-colors text-sm sm:text-base"
          >
            ← New dataset
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-4 lg:gap-6 xl:gap-8 h-[calc(100vh-8rem)] lg:h-[calc(100vh-10rem)]">
          <div className="space-y-4 flex flex-col min-w-0">
            <Waveform
              datasetId={datasetId}
              initialData={data}
              onDataUpdate={setData}
            />
            <div className="text-xs sm:text-sm text-white/40 text-center px-2">
              Drag peaks vertically to adjust cluster representation • 0% = exclude, 100% = original, 200% = 2x weight
            </div>
          </div>

          <div className="w-full xl:w-auto">
            <MetricsPanel data={data} datasetId={datasetId} />
          </div>
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
