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
import { AllWaveformsResponse, BaseWaveform, Waveform as WaveformType, WaveformMode } from '@/types';
import { apiClient } from '@/lib/api-client';

function VisualizeContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("id");
  const [baseData, setBaseData] = useState<BaseWaveform | null>(null);
  const [userData, setUserData] = useState<WaveformType | null>(null);
  const [aiData, setAiData] = useState<WaveformType | null>(null);
  const [metrics, setMetrics] = useState<AllWaveformsResponse['metrics'] | null>(null);
  const [strategy, setStrategy] = useState<string>("");
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
        const response = await apiClient.getWaveform(datasetId);
        setBaseData(response.base);
        setUserData(response.user);
        setAiData(response.ai);
        setMetrics(response.metrics);
        setStrategy(response.strategy);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchWaveform();
  }, [datasetId]);

  // Update all waveforms from API response
  const updateWaveforms = (response: AllWaveformsResponse) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 VISUALIZE: Updating waveforms from API');
    console.log('='.repeat(60));
    console.log('Response keys:', Object.keys(response));
    console.log('Base peaks:', response.base.peaks.length);
    console.log('User peaks:', response.user.peaks.length);
    console.log('AI peaks:', response.ai.peaks.length);
    console.log('Strategy:', response.strategy.substring(0, 100) + '...');
    console.log('Setting state...');

    setBaseData(response.base);
    setUserData(response.user);
    setAiData(response.ai);
    setMetrics(response.metrics);
    setStrategy(response.strategy);

    console.log('✅ State updated');
    console.log('='.repeat(60) + '\n');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !baseData || !userData || !aiData || !metrics || !datasetId) {
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
                baseData={baseData}
                userData={userData}
                aiData={aiData}
                onDataUpdate={updateWaveforms}
                onClusterClick={setSelectedClusterId}
                mode={mode}
              />
            </div>

            {/* Metrics Panel */}
            <MetricsPanel
              baseData={baseData}
              userData={userData}
              aiData={aiData}
              metrics={metrics}
              strategy={strategy}
              datasetId={datasetId}
              onSuggestionsReceived={updateWaveforms}
              mode={mode}
            />
          </div>

          <ClusterDetailModal
            cluster={baseData.peaks.find((p) => p.id === selectedClusterId) || null}
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
