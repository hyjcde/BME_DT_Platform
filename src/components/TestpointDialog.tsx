'use client';

import { getMetricMeta, getMetricTabs } from '@/data/monitoringMetrics';
import { Testpoint, useMonitoredData } from '@/context/MonitoredDataContext';
import { AnimatePresence, motion } from 'framer-motion';
import { Cloud, Droplets, Gauge, Image as ImageIcon, Sun, Thermometer, Wind, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface TestpointDialogProps {
  testpoint: Testpoint;
  onClose: () => void;
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return parsed.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTabIcon(metrics: string[]): ReactNode {
  const primary = metrics[0];
  switch (primary) {
    case 'temperature':
    case 'air_temperature':
    case 'globe_temperature':
    case 'surface_temperature':
    case 'dew_point':
      return <Thermometer className="w-4 h-4" />;
    case 'humidity':
      return <Droplets className="w-4 h-4" />;
    case 'wind_speed':
    case 'wind_direction':
      return <Wind className="w-4 h-4" />;
    case 'solar_radiation':
    case 'diffuse_radiation':
    case 'direct_normal_radiation':
    case 'direct_horizontal_radiation':
      return <Sun className="w-4 h-4" />;
    case 'pressure':
      return <Cloud className="w-4 h-4" />;
    default:
      return <Gauge className="w-4 h-4" />;
  }
}

function formatMetricValue(value: number, metricKey: string, unit: string): string {
  const decimals = metricKey === 'humidity' || metricKey === 'pm10' || metricKey === 'pm25' || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)}${unit}`;
}

export default function TestpointDialog({ testpoint, onClose }: TestpointDialogProps) {
  const { timeseries, currentFrame, getCurrentValue } = useMonitoredData();
  const availableMetrics = testpoint.available_metrics ?? Object.keys(testpoint.statistics);
  const tabs = useMemo(() => getMetricTabs(testpoint.device_type, availableMetrics), [availableMetrics, testpoint.device_type]);
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id ?? 'overview');
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    setActiveTab(tabs[0]?.id ?? 'overview');
  }, [tabs, testpoint.id]);

  const chartData = useMemo(() => {
    if (!activeTabConfig) return [];
    return timeseries
      .map((frame) => {
        const pointData = frame.testpoints[testpoint.id.toString()];
        if (!pointData) return null;
        const hasMetric = activeTabConfig.metrics.some((metric) => pointData[metric] != null);
        if (!hasMetric) return null;

        const dataPoint: Record<string, string | number | null> = {
          timestamp: frame.timestamp,
          label: formatTimestamp(frame.timestamp),
        };

        activeTabConfig.metrics.forEach((metric) => {
          dataPoint[metric] = pointData[metric] ?? null;
        });

        return dataPoint;
      })
      .filter((entry): entry is Record<string, string | number | null> => entry !== null);
  }, [activeTabConfig, testpoint.id, timeseries]);

  const latestTimestamp = timeseries[currentFrame]?.timestamp ?? chartData[chartData.length - 1]?.timestamp ?? null;
  const unitGroups = useMemo(() => {
    if (!activeTabConfig) return [];
    const groups = new Map<string, string[]>();
    activeTabConfig.metrics.forEach((metric) => {
      const unit = getMetricMeta(metric).unit || 'value';
      const metrics = groups.get(unit) ?? [];
      metrics.push(metric);
      groups.set(unit, metrics);
    });
    return Array.from(groups.entries());
  }, [activeTabConfig]);

  return (
    <div className="w-full h-full pointer-events-none p-4">
      <motion.div
        className="relative bg-slate-900/60 backdrop-blur-[32px] border border-slate-500/30 rounded-2xl shadow-[0_30px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 flex flex-col pointer-events-auto mx-auto mt-2"
        style={{ width: 620, maxHeight: '80vh', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 30px 80px -15px rgba(0,0,0,0.8)' }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-600/40 bg-slate-800/30 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">{testpoint.name}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{testpoint.location_name} · {testpoint.device_type}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700/50 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
          <div className="flex gap-5 mb-6 bg-slate-800/30 p-4 rounded-xl border border-slate-600/30 shadow-inner">
            <div className="w-24 h-24 bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-600/50 shrink-0 shadow-inner mt-1">
              <ImageIcon className="w-8 h-8 text-slate-400" />
            </div>
            <div className="flex-1 text-sm space-y-2.5 flex flex-col justify-center">
              <div className="text-slate-400 flex items-center gap-2">
                <span className="text-slate-300 font-semibold w-24">Location:</span>
                <span className="text-slate-100 font-medium">{testpoint.location_name}</span>
              </div>
              <div className="text-slate-400 flex items-center gap-2">
                <span className="text-slate-300 font-semibold w-24">Coordinates:</span>
                <span className="text-slate-100 font-medium">{testpoint.lat.toFixed(5)}°N, {testpoint.lng.toFixed(5)}°E</span>
              </div>
              <div className="text-slate-400 flex items-center gap-2">
                <span className="text-slate-300 font-semibold w-24">Last Updated:</span>
                <span className="text-slate-100 font-medium flex items-center gap-2">
                  {latestTimestamp ? formatTimestamp(latestTimestamp) : 'N/A'}
                  <span className="flex items-center gap-1.5 bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border border-green-500/30">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></span>
                    Real Data
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {availableMetrics.map((metricKey) => {
              const stats = testpoint.statistics[metricKey];
              const meta = getMetricMeta(metricKey);
              const current = getCurrentValue(testpoint.id, metricKey) ?? testpoint.current_values[metricKey] ?? null;
              if (!stats) return null;

              return (
                <div key={metricKey} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>{meta.shortLabel}</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {current != null ? formatMetricValue(current, metricKey, stats.unit) : '--'}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Avg {formatMetricValue(stats.avg, metricKey, stats.unit)} · Range {stats.min.toFixed(1)}-{stats.max.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-b border-slate-600/40 mb-6 px-1 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 pt-2 px-3 relative flex-1 flex items-center justify-center gap-2 transition-colors ${
                  activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={tab.label}
              >
                {getTabIcon(tab.metrics)}
                <span className="text-[11px] font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-px left-0 right-0 h-[3px] bg-blue-500 rounded-t-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="min-h-[320px] pb-2 relative">
            <h3 className="text-[15px] font-semibold text-white mb-4 tracking-wide flex items-center gap-2">
              {activeTabConfig?.label ?? 'Metrics'}
            </h3>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTabConfig?.id ?? 'empty'}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="h-full w-full min-w-0"
              >
                <div className="relative flex h-[320px] min-h-[320px] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-600/40 bg-slate-800/30 p-3 shadow-inner">
                  {chartData.length > 0 && activeTabConfig ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                      <LineChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 6 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={24} />
                        {unitGroups[0] && (
                          <YAxis
                            yAxisId="left"
                            stroke={getMetricMeta(unitGroups[0][1][0]).color}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                          />
                        )}
                        {unitGroups[1] && (
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke={getMetricMeta(unitGroups[1][1][0]).color}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                          />
                        )}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            padding: '8px 12px',
                          }}
                          labelStyle={{ color: '#e2e8f0' }}
                        />
                        <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                        {activeTabConfig.metrics.map((metricKey) => {
                          const meta = getMetricMeta(metricKey);
                          const axisId = unitGroups[1] && unitGroups[1][1].includes(metricKey) ? 'right' : 'left';
                          return (
                            <Line
                              key={metricKey}
                              yAxisId={axisId}
                              type="monotone"
                              dataKey={metricKey}
                              stroke={meta.color}
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                              name={`${meta.label} (${meta.unit})`}
                              isAnimationActive={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      No recorded values for the selected metrics.
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
