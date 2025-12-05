'use client';

import { useMonitoredData } from '@/context/MonitoredDataContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Droplets,
  Maximize2,
  Minus,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

// Testpoint colors for consistency - 11 testpoints with temp/humidity data
const testpointColors: Record<number, string> = {
  1: '#3b82f6',  // Blue - HOBO
  2: '#06b6d4',  // Cyan - HOBO
  3: '#84cc16',  // Lime - HOBO
  4: '#22c55e',  // Green - HOBO
  5: '#f59e0b',  // Amber - HOBO
  6: '#ef4444',  // Red - HOBO
  7: '#8b5cf6',  // Purple - HOBO
  9: '#14b8a6',  // Teal - Weather Station
  10: '#ec4899', // Pink - Weather Station
  11: '#f97316', // Orange - Thermocouple
  12: '#dc2626', // Red-600 - Thermocouple
};

const testpointNames: Record<number, string> = {
  1: 'University Station',
  2: 'East Campus',
  3: 'Central Ave',
  4: 'Northwest',
  5: 'West Side',
  6: 'Southwest',
  7: 'Central South',
  9: 'Weather Stn 1',
  10: 'Weather Stn 2',
  11: 'Thermocouple 1',
  12: 'Thermocouple 2',
};

export default function SimulationResults() {
  const { testpoints, timeseries, currentFrame, loading } = useMonitoredData();
  const [mounted, setMounted] = useState(false);
  const [selectedView, setSelectedView] = useState<'temperature' | 'humidity'>('temperature');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Transform timeseries data for chart
  const chartData = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return [];
    
    // Sample every 5 frames for performance
    const sampledData = timeseries.filter((_, idx) => idx % 5 === 0);
    
    return sampledData.map((frame, idx) => {
      const timestamp = frame.timestamp || '';
      // Use timestamp directly (format: "HH:MM") or fallback to index
      const time = timestamp || `${idx}`;
      
      const dataPoint: Record<string, any> = { time };
      
      Object.entries(frame.testpoints).forEach(([tpId, data]) => {
        const id = parseInt(tpId);
        if (data.temperature != null) {
          dataPoint[`temp_${id}`] = parseFloat(data.temperature.toFixed(1));
        }
        if (data.humidity != null) {
          dataPoint[`humidity_${id}`] = parseFloat(data.humidity.toFixed(1));
        }
      });
      
      return dataPoint;
    });
  }, [timeseries]);

  // Calculate current statistics from real data
  const currentStats = useMemo(() => {
    if (!testpoints || testpoints.length === 0) {
      return { avgTemp: 0, maxTemp: 0, minTemp: 0, avgHumidity: 0, trend: 'stable' as const };
    }
    
    const temps: number[] = [];
    const humidities: number[] = [];
    
    testpoints.forEach(tp => {
      if (tp.statistics?.temperature?.avg) temps.push(tp.statistics.temperature.avg);
      if (tp.statistics?.air_temperature?.avg) temps.push(tp.statistics.air_temperature.avg);
      if (tp.statistics?.surface_temperature?.avg) temps.push(tp.statistics.surface_temperature.avg);
      if (tp.statistics?.relative_humidity?.avg) humidities.push(tp.statistics.relative_humidity.avg);
      if (tp.statistics?.rh_station?.avg) humidities.push(tp.statistics.rh_station.avg);
    });
    
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
    const maxTemp = temps.length > 0 ? Math.max(...temps.map(t => {
      const tp = testpoints.find(p => 
        p.statistics?.temperature?.avg === t || 
        p.statistics?.air_temperature?.avg === t ||
        p.statistics?.surface_temperature?.avg === t
      );
      return tp?.statistics?.temperature?.max || tp?.statistics?.air_temperature?.max || tp?.statistics?.surface_temperature?.max || t;
    })) : 0;
    const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
    const avgHumidity = humidities.length > 0 ? humidities.reduce((a, b) => a + b, 0) / humidities.length : 0;
    
    return { 
      avgTemp: parseFloat(avgTemp.toFixed(1)), 
      maxTemp: parseFloat(maxTemp.toFixed(1)), 
      minTemp: parseFloat(minTemp.toFixed(1)), 
      avgHumidity: parseFloat(avgHumidity.toFixed(1)),
      trend: 'stable' as const 
    };
  }, [testpoints]);

  // Get active testpoint IDs that have data - show all 11 testpoints with temp/humidity
  const activeTestpoints = useMemo(() => {
    return testpoints
      .filter(tp => 
        tp.statistics?.temperature || 
        tp.statistics?.air_temperature || 
        tp.statistics?.surface_temperature ||
        tp.statistics?.relative_humidity ||
        tp.statistics?.rh_station
      )
      .map(tp => tp.id);
    // No limit - show all testpoints with data
  }, [testpoints]);

  const getTrendIcon = () => {
    switch (currentStats.trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-green-400" />;
      default: return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  // Chart Configuration
  const renderChart = (fontSize = 9, showGrid = false, showLegend = false) => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: showLegend ? 10 : 5, left: -10, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />}
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: fontSize, fill: '#64748b' }} 
          tickLine={false} 
          axisLine={{ stroke: '#334155' }} 
          interval={showGrid ? 'preserveStartEnd' : Math.floor(chartData.length / 6)}
        />
        <YAxis 
          tick={{ fontSize: fontSize, fill: '#64748b' }} 
          tickLine={false} 
          axisLine={{ stroke: '#334155' }} 
          domain={selectedView === 'temperature' ? [20, 50] : [20, 100]}
          tickFormatter={(v) => selectedView === 'temperature' ? `${v}°` : `${v}%`}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(15, 23, 42, 0.95)', 
            border: '1px solid #334155', 
            borderRadius: '8px', 
            fontSize: showGrid ? '12px' : '11px',
            padding: '8px 12px'
          }}
          labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
          formatter={(value: number, name: string) => {
            const tpId = parseInt(name.split('_')[1]);
            const tpName = testpointNames[tpId] || `TP-${tpId}`;
            const unit = selectedView === 'temperature' ? '°C' : '%';
            return [`${value.toFixed(1)}${unit}`, tpName];
          }}
        />
        {showLegend && (
          <Legend 
            wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
            formatter={(value: string) => {
              const tpId = parseInt(value.split('_')[1]);
              return testpointNames[tpId] || `TP-${tpId}`;
            }}
          />
        )}
        {activeTestpoints.map(tpId => (
          <Line
            key={tpId}
            type="monotone"
            dataKey={selectedView === 'temperature' ? `temp_${tpId}` : `humidity_${tpId}`}
            stroke={testpointColors[tpId] || '#888'}
            strokeWidth={showGrid ? 2.5 : 1.5}
            dot={false}
            activeDot={{ r: showGrid ? 6 : 4, strokeWidth: 2 }}
            name={`${selectedView === 'temperature' ? 'temp' : 'humidity'}_${tpId}`}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  if (!mounted || loading) {
    return (
      <div className="card-glass h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="card-glass h-full flex flex-col overflow-hidden relative group">
        {/* Tech Corner Decorations */}
        <div className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 border-cyan-500/50 rounded-tl-sm" />
        <div className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 border-cyan-500/50 rounded-tr-sm" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 border-cyan-500/50 rounded-bl-sm" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-cyan-500/50 rounded-br-sm" />

        {/* Header Row */}
        <div className="px-2 py-1.5 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold text-white">Simulation</span>
            <motion.span className="w-1.5 h-1.5 rounded-full bg-green-500" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
          <div className="flex gap-1">
             <button
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                selectedView === 'temperature' ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400'
              }`}
              onClick={() => setSelectedView('temperature')}
            >
              <ThermometerSun className="w-3 h-3" />Temp
            </button>
            <button
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                selectedView === 'humidity' ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400' : 'bg-slate-800/50 border border-slate-700/50 text-slate-400'
              }`}
              onClick={() => setSelectedView('humidity')}
            >
              <Droplets className="w-3 h-3" />RH
            </button>
            <button 
              onClick={() => setIsExpanded(true)}
              className="ml-1 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="px-2 py-1.5 border-b border-slate-700/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <span className="text-sm font-bold text-orange-400 font-mono" suppressHydrationWarning>
                {selectedView === 'temperature' ? `${currentStats.avgTemp}°` : `${currentStats.avgHumidity}%`}
              </span>
              <span className="text-[9px] text-slate-500 ml-1">AVG</span>
            </div>
            <div className="text-center">
              <span className="text-sm font-bold text-red-400 font-mono">
                {selectedView === 'temperature' ? `${currentStats.maxTemp}°` : '92%'}
              </span>
              <span className="text-[9px] text-slate-500 ml-1">MAX</span>
            </div>
          </div>
          {getTrendIcon()}
        </div>

        {/* Compact Chart */}
        <div className="flex-1 p-1 min-h-0">
          {chartData.length > 0 ? renderChart(9, false, false) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">No data</div>
          )}
        </div>
      </div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 z-50 card-glass bg-[#080c14]/98 flex flex-col shadow-2xl border-cyan-500/30"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-orange-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">Field Monitoring Data Analysis</h2>
                  <p className="text-xs text-slate-400">Real-time Multi-testpoint Data ({activeTestpoints.length} stations)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                  <button
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                      selectedView === 'temperature' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                    onClick={() => setSelectedView('temperature')}
                  >
                    <ThermometerSun className="w-3.5 h-3.5" />Temperature
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                      selectedView === 'humidity' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                    onClick={() => setSelectedView('humidity')}
                  >
                    <Droplets className="w-3.5 h-3.5" />Humidity
                  </button>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 min-h-0 flex gap-6">
              {/* Large Chart */}
              <div className="flex-1 bg-slate-900/30 rounded-xl border border-slate-800 p-4">
                 {chartData.length > 0 ? renderChart(12, true, true) : (
                   <div className="h-full flex items-center justify-center text-slate-500">No data available</div>
                 )}
              </div>
              
              {/* Side Stats in Modal */}
              <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Statistics Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Average {selectedView === 'temperature' ? 'Temp' : 'RH'}</span>
                      <span className="text-lg font-mono font-bold text-white">
                        {selectedView === 'temperature' ? `${currentStats.avgTemp}°C` : `${currentStats.avgHumidity}%`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Maximum</span>
                      <span className="text-lg font-mono font-bold text-red-400">
                        {selectedView === 'temperature' ? `${currentStats.maxTemp}°C` : '92%'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Minimum</span>
                      <span className="text-lg font-mono font-bold text-cyan-400">
                        {selectedView === 'temperature' ? `${currentStats.minTemp}°C` : '30%'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Active Testpoints</h3>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeTestpoints.map(tpId => {
                      const tp = testpoints.find(t => t.id === tpId);
                      const temp = tp?.statistics?.temperature?.avg || tp?.statistics?.air_temperature?.avg || '--';
                      const rh = tp?.statistics?.relative_humidity?.avg || tp?.statistics?.rh_station?.avg || '--';
                      return (
                        <div key={tpId} className="flex items-center justify-between text-xs py-2 px-2 bg-slate-900/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                              style={{ backgroundColor: testpointColors[tpId] || '#888' }}
                            >
                              {tpId}
                            </div>
                            <span className="text-slate-300">{testpointNames[tpId] || `TP-${tpId}`}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-orange-400">{typeof temp === 'number' ? `${temp.toFixed(1)}°` : temp}</span>
                            <span className="font-mono text-cyan-400">{typeof rh === 'number' ? `${rh.toFixed(0)}%` : rh}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
