'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Waveform from '@/components/Waveform';
import MetricsPanel from '@/components/MetricsPanel';
import LoadingSpinner from '@/components/LoadingSpinner';
import { WaveformData } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
        const response = await fetch(`${API_URL}/api/waveform/${datasetId}`);
        if (!response.ok) {
          throw new Error('Failed to load waveform data');
        }
        const waveformData = await response.json();
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
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dataset Visualization</h1>
            <p className="text-white/60 mt-2">
              Drag peaks up or down to adjust cluster weights
            </p>
          </div>
          <Link
            href="/"
            className="text-white/60 hover:text-white transition-colors"
          >
            ← New dataset
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
          <div className="space-y-4">
            <Waveform
              datasetId={datasetId}
              initialData={data}
              onDataUpdate={setData}
            />
            <div className="text-sm text-white/40 text-center">
              Drag peaks vertically to adjust cluster representation • 0% = exclude, 100% = original, 200% = 2x weight
            </div>
          </div>

          <MetricsPanel data={data} datasetId={datasetId} />
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
