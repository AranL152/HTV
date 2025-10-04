'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useDataset } from '@/hooks/useDataset';
import { useTerrain } from '@/hooks/useTerrain';
import { getExportUrl } from '@/services/api';
import TerrainMap from '@/components/visualization/TerrainMap';
import MetricsPanel from '@/components/controls/MetricsPanel';
import ClusterList from '@/components/controls/ClusterList';

function VisualizationContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get('id');
  const { terrain, status, loading, error } = useDataset(datasetId);
  const { terrainData, setTerrainData } = useTerrain();

  useEffect(() => {
    if (terrain) {
      setTerrainData(terrain);
    }
  }, [terrain, setTerrainData]);

  const handleExport = () => {
    if (datasetId) {
      window.location.href = getExportUrl(datasetId, 'weighted');
    }
  };

  if (!datasetId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No Dataset ID</h1>
          <p className="text-gray-400">Please upload a dataset first</p>
          <a
            href="/upload"
            className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
          >
            Go to Upload
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4" />
          {status && (
            <>
              <h2 className="text-2xl font-bold mb-2">{status.stage}</h2>
              <p className="text-gray-400 mb-4">{status.message}</p>
              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mx-auto">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 mt-2">{status.progress}% complete</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Processing Failed</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <a
            href="/upload"
            className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
          >
            Try Again
          </a>
        </div>
      </div>
    );
  }

  if (!terrainData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-950 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Level</h1>
          <p className="text-sm text-gray-400">Dataset Visualization</p>
        </div>
        <button
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Export Balanced Dataset
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <MetricsPanel metrics={terrainData.metrics} hills={terrainData.hills} />

        <div className="flex-1">
          <TerrainMap
            terrainData={terrainData}
            datasetId={datasetId}
            onTerrainUpdate={setTerrainData}
          />
        </div>

        <ClusterList
          hills={terrainData.hills}
          onFocusCluster={(id) => console.log('Focus cluster', id)}
          onResetCluster={(id) => {
            const hill = terrainData.hills.find((h) => h.id === id);
            if (hill) {
              const updatedHills = terrainData.hills.map((h) =>
                h.id === id ? { ...h, height: h.originalHeight, weight: 1.0 } : h
              );
              setTerrainData({ ...terrainData, hills: updatedHills });
            }
          }}
          onFlattenCluster={(id) => {
            const updatedHills = terrainData.hills.map((h) =>
              h.id === id ? { ...h, height: 0, weight: 0 } : h
            );
            setTerrainData({ ...terrainData, hills: updatedHills });
          }}
        />
      </div>
    </div>
  );
}

export default function VisualizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <VisualizationContent />
    </Suspense>
  );
}
