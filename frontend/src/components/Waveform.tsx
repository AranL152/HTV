"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { BaseWaveform, Waveform as WaveformType, AllWaveformsResponse, WaveformMode } from '@/types';
import { apiClient } from '@/lib/api-client';

interface WaveformProps {
  datasetId: string;
  baseData: BaseWaveform;
  userData: WaveformType;
  aiData: WaveformType;
  onDataUpdate: (data: AllWaveformsResponse) => void;
  onClusterClick?: (peakId: number) => void;
  mode: WaveformMode;
}

export default function Waveform({ datasetId, baseData, userData, aiData, onDataUpdate, onClusterClick, mode }: WaveformProps) {
  // Local state synced from parent - allows re-renders during drag
  const [localUserData, setLocalUserData] = useState<WaveformType>(userData);
  const [draggingPeak, setDraggingPeak] = useState<number | null>(null);
  const [hoveredPeak, setHoveredPeak] = useState<number | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  // Temporary state for optimistic drag updates before API sync
  const [tempUserData, setTempUserData] = useState<WaveformType | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Log props for debugging
  useEffect(() => {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 WAVEFORM: Props received');
    console.log('='.repeat(60));
    console.log('Base peaks:', baseData.peaks.length);
    console.log('User peaks:', userData.peaks.length);
    console.log('AI peaks:', aiData.peaks.length);
    console.log('\n📊 AI Peak Sample (first peak):');
    if (aiData.peaks.length > 0) {
      const peak = aiData.peaks[0];
      console.log(`  ID: ${peak.id}, Count: ${peak.count}, Weight: ${peak.weight}`);
      console.log(`  Label: ${peak.label}, Color: ${peak.color}`);
      console.log(`  X position: ${peak.x}`);
    }
    console.log('='.repeat(60) + '\n');
  }, [baseData, userData, aiData]);

  // Sync with parent when userData changes (from chat or mode switch)
  useEffect(() => {
    setLocalUserData(userData);
    setTempUserData(null); // Clear temp drag state on parent update
  }, [userData]);

  // Use temp user data while dragging, otherwise use synced data
  const displayUserData = tempUserData || localUserData;

  const width = 1100;
  const height = 700;
  const padding = 100;

  const generateUserPath = () => {
    if (displayUserData.peaks.length === 0) return "";

    if (mode === 'count') {
      // Find the maximum cluster size to normalize heights
      const maxSampleCount = Math.max(...baseData.peaks.map((p) => p.sampleCount));

      const points = displayUserData.peaks.map((p) => {
        // Calculate ratio based on absolute count vs max count
        const ratio = maxSampleCount > 0 ? p.count / maxSampleCount : 1;
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    } else {
      // Weight mode - fixed scale 0.01 to 2, with 1.0 near middle
      const minWeight = 0.01;
      const maxWeight = 2;

      const points = displayUserData.peaks.map((p) => {
        // Normalize to 0-1 range where 0.01 = bottom, 1.0 ≈ middle, 2.0 = top
        const ratio = (p.weight - minWeight) / (maxWeight - minWeight);
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    }
  };

  const generateBasePath = () => {
    if (baseData.peaks.length === 0) return "";

    if (mode === 'count') {
      // Find the maximum cluster size to normalize heights
      const maxSampleCount = Math.max(...baseData.peaks.map((p) => p.sampleCount));

      const points = baseData.peaks.map((p) => {
        // Always use original sampleCount for base path
        const ratio = maxSampleCount > 0 ? p.sampleCount / maxSampleCount : 1;
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    } else {
      // Weight mode: Show baseline (weight = 1.0) near middle
      const baselineWeight = 1.0;
      const minWeight = 0.01;
      const maxWeight = 2;

      const points = baseData.peaks.map((p) => {
        // Baseline 1.0 maps to near middle
        const ratio = (baselineWeight - minWeight) / (maxWeight - minWeight);
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    }
  };

  const generateAiPath = () => {
    console.log('🎨 Generating AI path...');
    console.log(`  AI peaks count: ${aiData.peaks.length}`);

    if (aiData.peaks.length === 0) {
      console.log('  ⚠️ No AI peaks - returning empty path');
      return "";
    }

    if (mode === 'count') {
      // Find the maximum cluster size to normalize heights
      const maxSampleCount = Math.max(...baseData.peaks.map((p) => p.sampleCount));

      const points = aiData.peaks.map((p) => {
        const ratio = maxSampleCount > 0 ? p.count / maxSampleCount : 1;
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      console.log(`  ✅ AI path generated (count mode): ${path.substring(0, 50)}...`);
      return path;
    } else {
      // Weight mode - fixed scale 0.01 to 2
      const minWeight = 0.01;
      const maxWeight = 2;

      const points = aiData.peaks.map((p) => {
        const ratio = (p.weight - minWeight) / (maxWeight - minWeight);
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      console.log(`  ✅ AI path generated (weight mode): ${path.substring(0, 50)}...`);
      return path;
    }
  };

  const handleMouseDown = (peakId: number) => {
    setDraggingPeak(peakId);
    setHasDragged(false);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingPeak === null || !svgRef.current) return;

    setHasDragged(true);
    const rect = svgRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const normalizedY = (y - padding) / (height - 2 * padding);
    const ratio = Math.max(0, Math.min(1, 1 - normalizedY));

    // Update temporary user data for immediate visual feedback
    setTempUserData((prevData) => {
      const currentData = prevData || localUserData;

      if (mode === 'count') {
        const maxSampleCount = Math.max(...baseData.peaks.map((p) => p.sampleCount));

        return {
          ...currentData,
          peaks: currentData.peaks.map((peak) => {
            if (peak.id === draggingPeak) {
              // Find corresponding base peak to get sampleCount limit
              const basePeak = baseData.peaks.find(p => p.id === peak.id);
              if (!basePeak) return peak;

              // Calculate count based on ratio relative to max, but clamp to peak's sampleCount
              const absoluteCount = Math.round(ratio * maxSampleCount);
              const newCount = Math.min(absoluteCount, basePeak.sampleCount);
              return { ...peak, count: newCount };
            }
            return peak;
          }),
        };
      } else {
        // Weight mode - fixed scale 0.01 to 2 (avoid exactly 0)
        const minWeight = 0.01;
        const maxWeight = 2;

        return {
          ...currentData,
          peaks: currentData.peaks.map((peak) => {
            if (peak.id === draggingPeak) {
              // Calculate weight based on ratio (0.01 to 2 range)
              const newWeight = minWeight + ratio * (maxWeight - minWeight);
              const clampedWeight = Math.max(minWeight, Math.min(maxWeight, newWeight));
              return { ...peak, weight: Number(clampedWeight.toFixed(2)) };
            }
            return peak;
          }),
        };
      }
    });
  };

  const finishDrag = useCallback(async () => {
    if (draggingPeak === null) return;

    const peakId = draggingPeak;
    const wasDragged = hasDragged;

    // Get the adjusted peak from temp user data if available
    const currentUserData = tempUserData || localUserData;
    const adjustedPeak = currentUserData.peaks.find((p) => p.id === draggingPeak);

    if (!adjustedPeak) return;

    // If it was a click (no drag), trigger the click handler
    if (!wasDragged && onClusterClick) {
      onClusterClick(peakId);
      setDraggingPeak(null);
      setTempUserData(null);
      return;
    }

    // Otherwise, sync with backend and update parent state
    try {
      if (mode === 'count') {
        const updatedData = await apiClient.adjustAmplitudes(datasetId, {
          adjustments: [{ id: adjustedPeak.id, count: adjustedPeak.count }],
        });

        onDataUpdate(updatedData);
      } else {
        const updatedData = await apiClient.adjustAmplitudes(datasetId, {
          adjustments: [{ id: adjustedPeak.id, weight: adjustedPeak.weight }],
        });

        onDataUpdate(updatedData);
      }
    } catch (err) {
      console.error("Failed to update peak:", err);
    }

    setDraggingPeak(null);
    setTempUserData(null);
  }, [draggingPeak, hasDragged, tempUserData, localUserData, mode, onClusterClick, datasetId, onDataUpdate]);

  const handleMouseUp = async () => {
    await finishDrag();
  };

  useEffect(() => {
    window.addEventListener('mouseup', finishDrag);
    return () => window.removeEventListener('mouseup', finishDrag);
  }, [finishDrag]);

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-[#333] rounded-lg bg-black cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Base waveform path (original cluster sizes) */}
        <path
          d={generateBasePath()}
          stroke="#808080"
          strokeWidth={2}
          fill="none"
        />

        {/* AI waveform path */}
        <path
          d={generateAiPath()}
          stroke="#9ca3af"
          strokeWidth={2}
          fill="none"
          strokeDasharray="5,5"
        />

        {/* User waveform path (current user adjustments) */}
        <path
          d={generateUserPath()}
          stroke="#ffffff"
          strokeWidth={2}
          fill="none"
        />

        {/* Base peak markers (original cluster sizes or baseline weight) */}
        {(() => {
          if (mode === 'count') {
            const maxSampleCount = Math.max(...baseData.peaks.map((p) => p.sampleCount));
            return baseData.peaks.map((peak) => {
              const ratio = maxSampleCount > 0 ? peak.sampleCount / maxSampleCount : 1;
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`base-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={6}
                  fill="#808080"
                  stroke="#808080"
                  strokeWidth={1}
                  className="pointer-events-none"
                />
              );
            });
          } else {
            // Weight mode: Show baseline weight = 1.0 near middle
            const baselineWeight = 1.0;
            const minWeight = 0.01;
            const maxWeight = 2;
            return baseData.peaks.map((peak) => {
              const ratio = (baselineWeight - minWeight) / (maxWeight - minWeight);
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`base-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={6}
                  fill="#808080"
                  stroke="#808080"
                  strokeWidth={1}
                  className="pointer-events-none"
                />
              );
            });
          }
        })()}

        {/* AI peak markers */}
        {(() => {
          if (mode === 'count') {
            const maxSampleCount = Math.max(...baseData.peaks.map((p) => p.sampleCount));
            return aiData.peaks.map((peak) => {
              const ratio = maxSampleCount > 0 ? peak.count / maxSampleCount : 1;
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`ai-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={5}
                  fill="#9ca3af"
                  stroke="#9ca3af"
                  strokeWidth={1}
                  className="pointer-events-none"
                />
              );
            });
          } else {
            // Weight mode - fixed scale 0.01 to 2
            const minWeight = 0.01;
            const maxWeight = 2;
            return aiData.peaks.map((peak) => {
              const ratio = (peak.weight - minWeight) / (maxWeight - minWeight);
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`ai-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={5}
                  fill="#9ca3af"
                  stroke="#9ca3af"
                  strokeWidth={1}
                  className="pointer-events-none"
                />
              );
            });
          }
        })()}

        {/* User peak markers (interactive) - render last for highest z-index */}
        <g className="z-10">
        {(() => {
          if (mode === 'count') {
            const maxSampleCount = Math.max(...baseData.peaks.map((p) => p.sampleCount));
            return displayUserData.peaks.map((peak, i) => {
              const basePeak = baseData.peaks[i];
              const ratio = maxSampleCount > 0 ? peak.count / maxSampleCount : 1;
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;
              const isDragging = draggingPeak === peak.id;
              const isHovered = hoveredPeak === peak.id;

              return (
                <g key={peak.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isDragging ? 10 : isHovered ? 8 : 6}
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="cursor-grab active:cursor-grabbing"
                    onMouseDown={() => handleMouseDown(peak.id)}
                    onMouseEnter={() => setHoveredPeak(peak.id)}
                    onMouseLeave={() => setHoveredPeak(null)}
                  />

                  {/* Label */}
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={12}
                    className="pointer-events-none select-none"
                  >
                    {peak.label}
                  </text>

                  {/* Count indicator on hover or drag */}
                  {(isHovered || isDragging) && (
                    <text
                      x={x}
                      y={y + 25}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={10}
                      className="pointer-events-none select-none"
                    >
                      {peak.count.toLocaleString()} / {basePeak.sampleCount.toLocaleString()}
                    </text>
                  )}
                </g>
              );
            });
          } else {
            // Weight mode - fixed scale 0.01 to 2
            const minWeight = 0.01;
            const maxWeight = 2;
            return displayUserData.peaks.map((peak) => {
              const ratio = (peak.weight - minWeight) / (maxWeight - minWeight);
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;
              const isDragging = draggingPeak === peak.id;
              const isHovered = hoveredPeak === peak.id;

              return (
                <g key={peak.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isDragging ? 10 : isHovered ? 8 : 6}
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="cursor-grab active:cursor-grabbing"
                    onMouseDown={() => handleMouseDown(peak.id)}
                    onMouseEnter={() => setHoveredPeak(peak.id)}
                    onMouseLeave={() => setHoveredPeak(null)}
                  />

                  {/* Label */}
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={12}
                    className="pointer-events-none select-none"
                  >
                    {peak.label}
                  </text>

                  {/* Weight indicator on hover or drag */}
                  {(isHovered || isDragging) && (
                    <text
                      x={x}
                      y={y + 25}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={10}
                      className="pointer-events-none select-none"
                    >
                      Weight: {peak.weight.toFixed(2)}x
                    </text>
                  )}
                </g>
              );
            });
          }
        })()}
        </g>
      </svg>
    </div>
  );
}
