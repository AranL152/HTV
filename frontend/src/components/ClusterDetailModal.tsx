'use client';

import { ClusterPeak } from '@/types';

interface ClusterDetailModalProps {
  cluster: ClusterPeak | null;
  onClose: () => void;
}

export default function ClusterDetailModal({ cluster, onClose }: ClusterDetailModalProps) {
  if (!cluster) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: cluster.color }}
            />
            <h2 className="text-2xl font-bold">{cluster.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black/30 rounded p-3">
            <div className="text-white/60 text-sm">Sample Count</div>
            <div className="text-xl font-semibold mt-1">{cluster.sampleCount.toLocaleString()}</div>
          </div>
          <div className="bg-black/30 rounded p-3">
            <div className="text-white/60 text-sm">Current Weight</div>
            <div className="text-xl font-semibold mt-1">{(cluster.weight * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* Sample Data */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Representative Samples</h3>
          {cluster.samples && cluster.samples.length > 0 ? (
            <div className="space-y-2">
              {cluster.samples.map((sample, idx) => (
                <div
                  key={idx}
                  className="bg-black/30 rounded p-3 text-sm font-mono text-white/80"
                >
                  {sample}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/40 text-sm">No sample data available</div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-6 bg-white text-black py-3 px-6 rounded font-medium hover:bg-white/90 transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}
