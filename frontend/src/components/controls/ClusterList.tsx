'use client';

import type { Hill } from '@/types/terrain';

interface ClusterListProps {
  hills: Hill[];
  onFocusCluster?: (hillId: number) => void;
  onResetCluster?: (hillId: number) => void;
  onFlattenCluster?: (hillId: number) => void;
}

export default function ClusterList({
  hills,
  onFocusCluster,
  onResetCluster,
  onFlattenCluster,
}: ClusterListProps) {
  const getWeightColor = (weight: number) => {
    if (weight < 0.5) return 'text-red-400';
    if (weight > 1.5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getWeightLabel = (weight: number) => {
    if (weight === 0) return 'Excluded';
    if (weight < 0.5) return 'Undersampled';
    if (weight > 1.5) return 'Oversampled';
    return 'Balanced';
  };

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6">Clusters</h2>

      <div className="space-y-4">
        {hills.map((hill) => (
          <div key={hill.id} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-2">
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: hill.color }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1">{hill.label}</h3>
                {hill.description && (
                  <p className="text-sm text-gray-400 mb-2">{hill.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">
                    {hill.sampleCount} samples
                  </span>
                  <span className={getWeightColor(hill.weight)}>
                    {hill.weight.toFixed(2)}x · {getWeightLabel(hill.weight)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onFocusCluster?.(hill.id)}
                className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Focus
              </button>
              <button
                onClick={() => onResetCluster?.(hill.id)}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => onFlattenCluster?.(hill.id)}
                className="flex-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Flatten
              </button>
            </div>

            {hill.samples && hill.samples.length > 0 && (
              <details className="mt-3">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                  View samples
                </summary>
                <div className="mt-2 space-y-1">
                  {hill.samples.slice(0, 3).map((sample, i) => (
                    <div key={i} className="text-xs text-gray-500 border-l-2 border-gray-700 pl-2">
                      {sample.substring(0, 80)}
                      {sample.length > 80 ? '...' : ''}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
