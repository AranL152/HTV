'use client';

import { WaveformData } from '@/types';
import { apiClient } from '@/lib/api-client';

interface MetricsPanelProps {
  data: WaveformData;
  datasetId: string;
}

export default function MetricsPanel({ data, datasetId }: MetricsPanelProps) {
  const handleExport = async () => {
    try {
      const blob = await apiClient.exportDataset(datasetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balanced_${datasetId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
      // TODO: Show user-friendly error toast
    }
  };

  return (
    <div className="border border-[#333] rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-semibold mb-4">Dataset Metrics</h2>

      <div className="space-y-4">
        <MetricRow
          label="Total Points"
          value={data.totalPoints.toLocaleString()}
        />
        <MetricRow
          label="Clusters"
          value={data.peaks.length.toString()}
        />
        <MetricRow
          label="Gini Coefficient"
          value={data.metrics.giniCoefficient.toFixed(3)}
          subtitle="Lower is more balanced (0 = perfect equality)"
        />
        <MetricRow
          label="Flatness Score"
          value={data.metrics.flatnessScore.toFixed(3)}
          subtitle="Higher is more balanced (1 = perfectly flat)"
        />
        <MetricRow
          label="Avg Amplitude"
          value={data.metrics.avgAmplitude.toFixed(3)}
        />
      </div>

      <div className="pt-4 border-t border-[#333]">
        <h3 className="text-sm font-semibold mb-3">Cluster Breakdown</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.peaks.map((peak) => (
            <div key={peak.id} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: peak.color }}
              />
              <span className="flex-1 truncate">{peak.label}</span>
              <span className="text-white/60">
                {peak.sampleCount} ({(peak.weight * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleExport}
        className="w-full bg-white text-black py-3 px-6 rounded font-medium hover:bg-white/90 transition-all"
      >
        Export Balanced CSV
      </button>
    </div>
  );
}

function MetricRow({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="text-white/60 text-sm">{label}</span>
        <span className="font-mono font-semibold">{value}</span>
      </div>
      {subtitle && (
        <div className="text-xs text-white/40 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
