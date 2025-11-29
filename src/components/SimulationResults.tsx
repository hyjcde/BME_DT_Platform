'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, 
  ThermometerSun, 
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

// Generate simulation data for 48 hours
const generateTimeData = () => {
  const data = [];
  const startHour = 9;
  for (let i = 0; i < 48; i++) {
    const hour = (startHour + Math.floor(i / 2)) % 24;
    const minute = (i % 2) * 30;
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    const isDaytime = hour >= 9 && hour <= 18;
    const peakHour = hour >= 12 && hour <= 15;
    const baseTemp = isDaytime ? (peakHour ? 38 : 32) : 27;
    
    const sensors = ['293', '296', '307', '326', '251', '301', '310'];
    const tempData: Record<string, number> = {};
    const humidityData: Record<string, number> = {};
    
    sensors.forEach((sensor, idx) => {
      const variation = (Math.sin(i * 0.3 + idx) * 3) + (Math.random() - 0.5) * 2;
      const sensorOffset = (idx - 3) * 1.5;
      tempData[`temp_${sensor}`] = +(baseTemp + variation + sensorOffset).toFixed(1);
      
      const baseHumidity = isDaytime ? (peakHour ? 45 : 55) : 85;
      const humidityVariation = (Math.sin(i * 0.3 + idx + 1) * 8) + (Math.random() - 0.5) * 5;
      humidityData[`humidity_${sensor}`] = Math.min(95, Math.max(30, +(baseHumidity + humidityVariation).toFixed(1)));
    });
    
    data.push({ time: timeStr, ...tempData, ...humidityData });
  }
  return data;
};

const sensorColors: Record<string, string> = {
  '293': '#3b82f6', '296': '#06b6d4', '307': '#84cc16', '326': '#22c55e',
  '251': '#f97316', '301': '#ef4444', '310': '#8b5cf6',
};

const sensors = ['293', '296', '307', '326', '251', '301', '310'];

export default function SimulationResults() {
  const [data, setData] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [selectedView, setSelectedView] = useState<'temperature' | 'humidity'>('temperature');
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentStats, setCurrentStats] = useState({
    avgTemp: 35.2, maxTemp: 43.5, minTemp: 26.8, avgHumidity: 62.3,
    trend: 'up' as 'up' | 'down' | 'stable'
  });

  useEffect(() => {
    setMounted(true);
    setData(generateTimeData());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setCurrentStats(prev => ({
        ...prev,
        avgTemp: +(prev.avgTemp + (Math.random() - 0.5) * 0.3).toFixed(1),
        avgHumidity: +(prev.avgHumidity + (Math.random() - 0.5) * 1).toFixed(1),
        trend: Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down'
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [mounted]);

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
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />}
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: fontSize, fill: '#64748b' }} 
          tickLine={false} 
          axisLine={{ stroke: '#334155' }} 
          interval={showGrid ? 5 : 11} 
        />
        <YAxis 
          tick={{ fontSize: fontSize, fill: '#64748b' }} 
          tickLine={false} 
          axisLine={{ stroke: '#334155' }} 
          domain={selectedView === 'temperature' ? [18, 48] : [20, 100]}
          tickFormatter={(v) => selectedView === 'temperature' ? `${v}°` : `${v}%`}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: '6px', fontSize: '12px' }}
          labelStyle={{ color: '#94a3b8' }}
        />
        {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}
        {sensors.map(sensor => (
          <Line
            key={sensor}
            type="monotone"
            dataKey={selectedView === 'temperature' ? `temp_${sensor}` : `humidity_${sensor}`}
            stroke={sensorColors[sensor]}
            strokeWidth={showGrid ? 2 : 1.5}
            dot={false}
            activeDot={{ r: 4 }}
            name={sensor}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  if (!mounted) return null;

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
                {selectedView === 'temperature' ? `${currentStats.maxTemp}°` : '89%'}
              </span>
              <span className="text-[9px] text-slate-500 ml-1">MAX</span>
            </div>
          </div>
          {getTrendIcon()}
        </div>

        {/* Compact Chart */}
        <div className="flex-1 p-1 min-h-0">
          {renderChart(9, false, false)}
        </div>
      </div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 z-50 card-glass bg-[#080c14]/95 flex flex-col shadow-2xl border-cyan-500/30"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-orange-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">Detailed Simulation Analysis</h2>
                  <p className="text-xs text-slate-400">Multi-sensor Historical Data Series (48h)</p>
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
                 {renderChart(12, true, true)}
              </div>
              
              {/* Side Stats in Modal */}
              <div className="w-64 shrink-0 space-y-4">
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Current Readings</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Average</span>
                      <span className="text-lg font-mono font-bold text-white">
                        {selectedView === 'temperature' ? `${currentStats.avgTemp}°C` : `${currentStats.avgHumidity}%`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Maximum</span>
                      <span className="text-lg font-mono font-bold text-red-400">
                        {selectedView === 'temperature' ? `${currentStats.maxTemp}°C` : '89.2%'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Trend</span>
                      <div className="flex items-center gap-1 text-green-400">
                        {getTrendIcon()}
                        <span className="text-xs">Stable</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Sensor Status</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {sensors.map(sensor => (
                      <div key={sensor} className="flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sensorColors[sensor] }} />
                          <span className="text-slate-400">Sensor {sensor}</span>
                        </div>
                        <span className="font-mono text-slate-300">Online</span>
                      </div>
                    ))}
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
