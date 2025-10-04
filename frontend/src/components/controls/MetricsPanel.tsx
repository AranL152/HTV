'use client';

import type { BiasMetrics, Hill } from '@/types/terrain';

interface MetricsPanelProps {
  metrics: BiasMetrics;
  hills: Hill[];
}

export default function MetricsPanel({ metrics, hills }: MetricsPanelProps) {
  const flatnessPercent = (metrics.flatnessScore * 100).toFixed(0);
  const giniPercent = (metrics.giniCoefficient * 100).toFixed(0);

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-800 p-6 overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6">Dataset Metrics</h2>

      <div className="space-y-6">
        <div>
          <div className="text-sm text-gray-400 mb-1">Total Data Points</div>
          <div className="text-3xl font-bold">{metrics.totalPoints.toLocaleString()}</div>
        </div>

        <div>
          <div className="text-sm text-gray-400 mb-1">Clusters Found</div>
          <div className="text-3xl font-bold">{metrics.clusterCount}</div>
        </div>

        <div>
          <div className="text-sm text-gray-400 mb-2">Gini Coefficient</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600"
                style={{ width: `${giniPercent}%` }}
              />
            </div>
            <div className="text-lg font-semibold w-12 text-right">{giniPercent}%</div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Higher = more unequal distribution
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-400 mb-2">Flatness Score</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600"
                style={{ width: `${flatnessPercent}%` }}
              />
            </div>
            <div className="text-lg font-semibold w-12 text-right">{flatnessPercent}%</div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Higher = more balanced dataset
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6">
          <h3 className="text-lg font-semibold mb-4">Cluster Summary</h3>
          <div className="space-y-3">
            {hills.map((hill) => (
              <div key={hill.id} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: hill.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{hill.label}</div>
                  <div className="text-xs text-gray-400">
                    {hill.sampleCount} samples · {hill.weight.toFixed(2)}x weight
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
