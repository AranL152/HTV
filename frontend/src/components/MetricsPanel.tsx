"use client";

import { useState, useEffect } from 'react';
import { WaveformData, WaveformMode } from '@/types';
import { apiClient } from '@/lib/api-client';
import ChatBox from './ChatBox';

interface MetricsPanelProps {
  data: WaveformData;
  datasetId: string;
  onSuggestionsReceived?: (suggestions: WaveformData) => void;
  mode: WaveformMode;
}

type TabMode = "info" | "chat";

export default function MetricsPanel({ data, datasetId, onSuggestionsReceived, mode }: MetricsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('info');

  // Load saved tab preference from localStorage on mount
  useEffect(() => {
    const storageKey = `metrics-tab-${datasetId}`;
    const savedTab = localStorage.getItem(storageKey);
    if (savedTab === "info" || savedTab === "chat") {
      setActiveTab(savedTab);
    }
  }, [datasetId]);

  // Save tab preference to localStorage whenever it changes
  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    const storageKey = `metrics-tab-${datasetId}`;
    localStorage.setItem(storageKey, tab);
  };
  const handleExport = async () => {
    try {
      const blob = await apiClient.exportDataset(datasetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `balanced_${datasetId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
      // TODO: Show user-friendly error toast
    }
  };

  return (
    <div className="border border-[#333] rounded-lg overflow-hidden flex flex-col h-full w-full">
      {/* Tab Header */}
      <div className="flex border-b border-[#333]">
        <button
          onClick={() => handleTabChange("info")}
          className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-colors text-sm sm:text-base ${
            activeTab === "info"
              ? "bg-white/10 text-white border-b-2 border-white"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          Info
        </button>
        <button
          onClick={() => handleTabChange("chat")}
          className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-colors text-sm sm:text-base ${
            activeTab === "chat"
              ? "bg-white/10 text-white border-b-2 border-white"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          Chat
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "info" ? (
          <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 h-full overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-semibold">
              Dataset Metrics
            </h2>

            <div className="space-y-3 lg:space-y-4">
              <MetricRow
                label="Total Points"
                value={data.totalPoints.toLocaleString()}
              />
              <MetricRow
                label="Clusters"
                value={data.peaks.length.toString()}
              />
              {mode === 'count' ? (
                <>
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
                    subtitle="Average selection ratio across clusters"
                  />
                </>
              ) : (
                <>
                  <MetricRow
                    label="Avg Weight"
                    value={(data.peaks.reduce((sum, p) => sum + (p.weight ?? 1.0), 0) / data.peaks.length).toFixed(2)}
                    subtitle="Average cluster weight"
                  />
                  <MetricRow
                    label="Max Weight"
                    value={Math.max(...data.peaks.map(p => p.weight ?? 1.0)).toFixed(2)}
                    subtitle="Highest cluster weight"
                  />
                  <MetricRow
                    label="Min Weight"
                    value={Math.min(...data.peaks.map(p => p.weight ?? 1.0)).toFixed(2)}
                    subtitle="Lowest cluster weight"
                  />
                </>
              )}
            </div>

            <div className="pt-3 lg:pt-4 border-t border-[#333]">
              <h3 className="text-xs sm:text-sm font-semibold mb-2 lg:mb-3">
                Cluster Breakdown
              </h3>
              <div className="space-y-1 lg:space-y-2 max-h-24 lg:max-h-32 overflow-y-auto">
                {data.peaks.map((peak) => (
                  <div
                    key={peak.id}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 bg-white" />
                    <span className="flex-1 truncate min-w-0">
                      {peak.label}
                    </span>
                    <span className="text-white/60 text-xs sm:text-sm flex-shrink-0">
                      {mode === 'count'
                        ? `${peak.sampleCount.toLocaleString()} (${(peak.selectedCount ?? peak.sampleCount).toLocaleString()} selected)`
                        : `Weight: ${(peak.weight ?? 1.0).toFixed(2)}x`
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleExport}
              className="w-full bg-white text-black py-2 sm:py-3 px-4 sm:px-6 rounded font-medium hover:bg-white/90 transition-all text-sm sm:text-base"
            >
              Export Balanced CSV
            </button>
          </div>
        ) : (
          <div className="h-full p-2 sm:p-4">
            <ChatBox
              datasetId={datasetId}
              onSuggestionsReceived={onSuggestionsReceived}
            />
          </div>
        )}
      </div>
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
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-white/60 text-xs sm:text-sm flex-shrink-0">
          {label}
        </span>
        <span className="font-mono font-semibold text-xs sm:text-sm text-right">
          {value}
        </span>
      </div>
      {subtitle && (
        <div className="text-xs text-white/40 mt-1 leading-tight">
          {subtitle}
        </div>
      )}
    </div>
  );
}
