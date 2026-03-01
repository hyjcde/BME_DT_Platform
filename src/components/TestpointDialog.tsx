'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMonitoredData, Testpoint } from '@/context/MonitoredDataContext';
import { 
  X, 
  Thermometer, 
  Sun, 
  Wind, 
  Droplets, 
  User, 
  Cloud, 
  Leaf,
  Image as ImageIcon
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  ReferenceLine,
  ReferenceArea
} from 'recharts';

interface TestpointDialogProps {
  testpoint: Testpoint;
  onClose: () => void;
}

type TabType = 'temp' | 'sun' | 'wind' | 'rain' | 'user' | 'cloud' | 'leaf';

const TABS: { id: TabType; icon: React.FC<any>; label: string }[] = [
  { id: 'temp', icon: Thermometer, label: 'Air Temperature (°C)' },
  { id: 'sun', icon: Sun, label: 'Solar Irradiation (W/m²)' },
  { id: 'wind', icon: Wind, label: 'Wind Direction and Speed (m/s)' },
  { id: 'rain', icon: Droplets, label: 'Rainfall' },
  { id: 'user', icon: User, label: 'Thermal Comfort' },
  { id: 'cloud', icon: Cloud, label: 'Weather' },
  { id: 'leaf', icon: Leaf, label: 'Environment' },
];

const hours24 = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// Mock wind rose data
const windData = [
  { subject: 'N', speed: 1.5, gust: 2.5, fullMark: 5 },
  { subject: 'NE', speed: 0.5, gust: 1.2, fullMark: 5 },
  { subject: 'E', speed: 0.2, gust: 0.8, fullMark: 5 },
  { subject: 'SE', speed: 1.8, gust: 3.0, fullMark: 5 },
  { subject: 'S', speed: 2.5, gust: 4.2, fullMark: 5 },
  { subject: 'SW', speed: 1.2, gust: 2.0, fullMark: 5 },
  { subject: 'W', speed: 0.4, gust: 1.0, fullMark: 5 },
  { subject: 'NW', speed: 0.6, gust: 1.5, fullMark: 5 },
];

// Mock rain & humidity data (24h)
const rainData = hours24.map((time, i) => {
  const isRaining = i >= 14 && i <= 18;
  return {
    time,
    amount: isRaining ? Number((Math.abs(Math.sin(i)) * 8 + Math.random() * 2).toFixed(1)) : 0,
    humidity: Number((60 + Math.sin(i * 0.3) * 20 + (isRaining ? 15 : 0) + Math.random() * 5).toFixed(0)),
  };
});

// Mock thermal comfort (PMV & PPD) data (24h)
const comfortData = hours24.map((time, i) => {
  const pmv = Number((Math.sin((i - 8) * 0.26) * 2 + Math.random() * 0.4 - 0.2).toFixed(2));
  const ppd = Number((5 + Math.pow(Math.abs(pmv), 1.5) * 15 + Math.random() * 5).toFixed(1)); 
  return { time, pmv, ppd: Math.min(100, ppd) };
});

// Mock weather (Cloud Cover & UV) data (24h)
const cloudData = hours24.map((time, i) => {
  const uv = i > 6 && i < 19 ? Number((Math.sin((i - 6) * 0.25) * 8 + Math.random() * 2).toFixed(1)) : 0;
  const cover = Number((40 + Math.sin(i * 0.4) * 40 + Math.random() * 20).toFixed(0));
  return { time, cover: Math.min(100, cover), uv };
});

// Mock environment (AQI, PM2.5, PM10) data (24h)
const envData = hours24.map((time, i) => {
  const aqi = Number((45 + Math.sin(i * 0.2) * 25 + Math.random() * 10).toFixed(0));
  const pm25 = Number((aqi * 0.4 + Math.random() * 5).toFixed(0));
  const pm10 = Number((aqi * 0.7 + Math.random() * 8).toFixed(0));
  return { time, aqi, pm25, pm10 };
});

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-600 shadow-2xl rounded-xl p-3 backdrop-blur-xl min-w-[150px]">
        <div className="text-slate-400 text-xs mb-2 pb-2 border-b border-slate-700/50 font-medium flex justify-between items-center">
          <span>{label || 'Data Info'}</span>
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse ml-4 shadow-[0_0_8px_#22d3ee]"></span>
        </div>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-slate-300">{entry.name}</span>
              </div>
              <span className="font-bold text-white tracking-wide">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function TestpointDialog({ testpoint, onClose }: TestpointDialogProps) {
  const { timeseries } = useMonitoredData();
  const [activeTab, setActiveTab] = useState<TabType>('temp');

  // Format the last updated time (using the last timestamp in the timeseries)
  const lastUpdated = timeseries.length > 0 
    ? new Date(Date.now()).toLocaleString() // Mocking current date for demo
    : '02/28/2026, 19:14:15'; // Fallback to match screenshot exactly

  // Generate mock heatmap data for Air Temperature
  const tempHours = ['22:00', '20:00', '18:00', '16:00', '14:00', '12:00', '10:00', '08:00', '06:00', '04:00', '02:00', '00:00'];
  const days = ['Feb 1', 'Feb 8', 'Feb 15', 'Feb 22'];
  
  const generateTempHeatmapColor = (hourIdx: number, dayIdx: number) => {
    // Determine color based on time and day with consistency to reduce flickering
    const isHotHour = hourIdx >= 3 && hourIdx <= 6;
    
    // Create a stable pattern using a mix of coordinate properties
    const seedX = Math.sin(dayIdx * 12.9898) * 43758.5453;
    const seedY = Math.sin(hourIdx * 78.233) * 43758.5453;
    const noise = (seedX + seedY) - Math.floor(seedX + seedY);
    
    if (isHotHour) {
      // Hotter values during midday
      const intensity = 0.5 + noise * 0.5; // 0.5 to 1.0 range
      return `rgba(239, 68, 68, ${intensity})`; // Red-ish
    } else if (hourIdx === 2 || hourIdx === 7) {
      // Transition hours (warm but not peak)
      const intensity = 0.4 + noise * 0.4;
      return `rgba(249, 115, 22, ${intensity})`; // Orange-ish
    } else {
      // Cooler hours
      const intensity = 0.3 + noise * 0.6; // 0.3 to 0.9 range
      return `rgba(59, 130, 246, ${intensity})`; // Blue-ish
    }
  };

  // Generate mock heatmap data for Solar Irradiation
  const solarHours = ['19:00', '17:00', '15:00', '13:00', '11:00', '09:00', '07:00'];
  
  const generateSolarHeatmapColor = (hourIdx: number, dayIdx: number) => {
    const isPeakHour = hourIdx >= 2 && hourIdx <= 4; 
    const isActiveHour = hourIdx >= 1 && hourIdx <= 5;
    
    // Better pseudo-random noise function
    const seedX = Math.sin(dayIdx * 25.123) * 43758.5453;
    const seedY = Math.sin(hourIdx * 45.456) * 43758.5453;
    const noise = (seedX + seedY) - Math.floor(seedX + seedY);
    
    // Simulate scattered clouds (15% chance of cloud cover)
    if (noise > 0.85) {
      return `rgba(37, 99, 235, ${0.4 + (noise - 0.85) * 4})`; // Blue-ish (cloudy)
    }

    if (isPeakHour) {
      const intensity = 0.6 + noise * 0.4;
      return `rgba(220, 38, 38, ${intensity})`; // Strong Red
    } else if (isActiveHour) {
      const intensity = 0.5 + noise * 0.5;
      return `rgba(249, 115, 22, ${intensity})`; // Orange
    } else {
      const intensity = 0.3 + noise * 0.5;
      return `rgba(29, 78, 216, ${intensity})`; // Dark Blue
    }
  };

  return (
    <div className="w-full h-full pointer-events-none p-4">
      <motion.div 
        className="relative bg-slate-900/60 backdrop-blur-[32px] border border-slate-500/30 rounded-2xl shadow-[0_30px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 flex flex-col pointer-events-auto mx-auto mt-2"
        style={{ width: 560, maxHeight: '80vh', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 30px 80px -15px rgba(0,0,0,0.8)' }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()} // Prevent map clicks
      >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-600/40 bg-slate-800/30 shrink-0">
        <h2 className="text-xl font-bold text-white tracking-wide">
          Weather Station {testpoint.id}
        </h2>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-slate-700/50 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
        {/* Info Section */}
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
                <span className="text-slate-300 font-semibold w-24">Type:</span>
                <span className="text-slate-100 font-medium">{testpoint.device_type}</span>
              </div>
              <div className="text-slate-400 flex items-center gap-2">
                <span className="text-slate-300 font-semibold w-24">Last Updated:</span>
                <span className="text-slate-100 font-medium flex items-center gap-2">
                  {lastUpdated}
                  <span className="flex items-center gap-1.5 bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border border-green-500/30">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></span>
                    Live
                  </span>
                </span>
              </div>
              <div className="pt-2 flex gap-2">
                <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] active:scale-95">
                  View Past Data
                </button>
                <button className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-wider transition-all active:scale-95 border border-slate-600">
                  Export CSV
                </button>
              </div>
            </div>
          </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-slate-600/40 mb-6 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 pt-2 px-3 relative flex-1 flex justify-center transition-colors ${
                activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={tab.label}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]' : ''}`} />
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -bottom-px left-0 right-0 h-[3px] bg-blue-500 rounded-t-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>

          {/* Tab Content */}
          <div className="min-h-[260px] pb-2 relative">
            <h3 className="text-[15px] font-semibold text-white mb-4 tracking-wide flex items-center gap-2">
              {TABS.find(t => t.id === activeTab)?.label}
            </h3>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="w-full h-full"
              >
            
            {activeTab === 'temp' && (
              <div className="relative bg-slate-800/30 p-5 rounded-xl border border-slate-600/40 shadow-inner">
                <div className="flex">
                  {/* Y Axis */}
                  <div className="flex flex-col justify-between text-[11px] font-medium text-slate-400 pr-3 pb-7 pt-1">
                    {tempHours.map(h => <span key={h}>{h}</span>)}
                  </div>
                {/* Grid */}
                <div className="flex-1 border-l border-b border-slate-500/50 relative">
                  <div className="grid grid-rows-12 grid-cols-24 h-[220px] bg-slate-800/50" style={{ gap: '1px' }}>
                    {Array.from({ length: 12 }).map((_, r) => (
                      Array.from({ length: 24 }).map((_, c) => (
                        <div 
                          key={`${r}-${c}`} 
                          style={{ backgroundColor: generateTempHeatmapColor(r, c) }}
                          className="w-full h-full hover:opacity-70 hover:scale-125 hover:z-10 transition-all cursor-pointer shadow-sm"
                          title={`Hour: ${tempHours[r]}, Day: ${c}`}
                        />
                      ))
                    ))}
                  </div>
                    {/* X Axis */}
                    <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-3 px-4">
                      {days.map(d => (
                        <div key={d} className="flex flex-col items-center gap-1.5">
                          <div className="h-1.5 w-px bg-slate-500" />
                          <span>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="ml-5 w-8 h-[220px] flex flex-col items-center">
                    <div className="text-[11px] font-bold text-slate-300 mb-2">35</div>
                    <div className="w-3.5 flex-1 rounded-full bg-linear-to-t from-blue-500 via-yellow-400 to-red-500 shadow-[inset_0_0_8px_rgba(0,0,0,0.6)] border border-slate-700/50" />
                    <div className="text-[11px] font-bold text-slate-300 mt-2">25</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sun' && (
              <div className="relative bg-slate-800/30 p-5 rounded-xl border border-slate-600/40 shadow-inner">
                <div className="flex">
                  {/* Y Axis */}
                  <div className="flex flex-col justify-between text-[11px] font-medium text-slate-400 pr-3 pb-7 pt-1">
                    {solarHours.map(h => <span key={h}>{h}</span>)}
                  </div>
                {/* Grid */}
                <div className="flex-1 border-l border-b border-slate-500/50 relative">
                  <div className="grid grid-rows-7 grid-cols-24 h-[220px] bg-slate-800/50" style={{ gap: '1px' }}>
                    {Array.from({ length: 7 }).map((_, r) => (
                      Array.from({ length: 24 }).map((_, c) => (
                        <div 
                          key={`${r}-${c}`} 
                          style={{ backgroundColor: generateSolarHeatmapColor(r, c) }}
                          className="w-full h-full hover:opacity-70 hover:scale-125 hover:z-10 transition-all cursor-pointer shadow-sm"
                          title={`Hour: ${solarHours[r]}, Day: ${c}`}
                        />
                      ))
                    ))}
                  </div>
                    {/* X Axis */}
                    <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-3 px-4">
                      {days.map(d => (
                        <div key={d} className="flex flex-col items-center gap-1.5">
                          <div className="h-1.5 w-px bg-slate-500" />
                          <span>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="ml-5 w-8 h-[220px] flex flex-col items-center relative">
                    <div className="text-[11px] font-bold text-slate-300 mb-2">800</div>
                    <div className="text-[11px] font-bold text-slate-400 absolute top-14">600</div>
                    <div className="text-[11px] font-bold text-slate-400 absolute top-28">400</div>
                    <div className="text-[11px] font-bold text-slate-400 absolute bottom-16">200</div>
                    <div className="w-3.5 flex-1 rounded-full bg-linear-to-t from-blue-700 via-orange-400 to-red-600 shadow-[inset_0_0_8px_rgba(0,0,0,0.6)] border border-slate-700/50" />
                    <div className="text-[11px] font-bold text-slate-300 mt-2">0</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'wind' && (
              <div className="flex flex-col h-[280px] w-full bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-2 relative overflow-hidden">
                {/* Wind KPIs */}
                <div className="flex justify-around items-center px-2 py-1.5 border-b border-slate-700/50 mb-2 shrink-0 bg-slate-800/50 rounded-lg">
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Max Speed</div><div className="text-[13px] font-bold text-blue-400 flex items-center gap-1 justify-center">2.5 m/s<span className="text-[8px] text-emerald-400">↑</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Max Gust</div><div className="text-[13px] font-bold text-purple-400 flex items-center gap-1 justify-center">4.2 m/s<span className="text-[8px] text-emerald-400">↑</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Prevailing</div><div className="text-[13px] font-bold text-white flex items-center gap-1 justify-center">South<span className="text-[8px] text-slate-500">-</span></div></div>
                </div>
                <div className="flex-1 min-h-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="60%" data={windData}>
                      <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}/>
                      <Radar name="Wind Gust" dataKey="gust" stroke="#8b5cf6" strokeWidth={1} fill="#a855f7" fillOpacity={0.2} isAnimationActive={false} />
                      <Radar name="Wind Speed" dataKey="speed" stroke="#3b82f6" strokeWidth={2} fill="#60a5fa" fillOpacity={0.5} isAnimationActive={false} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'rain' && (
              <div className="flex flex-col h-[280px] w-full bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-2 relative overflow-hidden">
                <div className="flex justify-around items-center px-2 py-1.5 border-b border-slate-700/50 mb-2 shrink-0 bg-slate-800/50 rounded-lg">
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">24h Total</div><div className="text-[13px] font-bold text-blue-400 flex items-center gap-1 justify-center">18.4 mm<span className="text-[8px] text-emerald-400">↑</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Peak Humidity</div><div className="text-[13px] font-bold text-cyan-400 flex items-center gap-1 justify-center">92%<span className="text-[8px] text-emerald-400">↑</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Status</div><div className="text-[13px] font-bold text-green-400 flex items-center gap-1 justify-center">Light Rain<span className="text-[8px] text-slate-500">-</span></div></div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rainData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}mm`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                      <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}/>
                      <Bar yAxisId="left" dataKey="amount" fill="url(#colorRain)" radius={[4, 4, 0, 0]} name="Rainfall" maxBarSize={20} isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2} dot={false} name="Humidity" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'user' && (
              <div className="flex flex-col h-[280px] w-full bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-2 relative overflow-hidden">
                <div className="flex justify-around items-center px-2 py-1.5 border-b border-slate-700/50 mb-2 shrink-0 bg-slate-800/50 rounded-lg">
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Avg PMV</div><div className="text-[13px] font-bold text-rose-400 flex items-center gap-1 justify-center">+1.2<span className="text-[8px] text-emerald-400">↓ 0.1</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Max PPD</div><div className="text-[13px] font-bold text-yellow-400 flex items-center gap-1 justify-center">42%<span className="text-[8px] text-red-400">↑ 5%</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Assessment</div><div className="text-[13px] font-bold text-orange-400 flex items-center gap-1 justify-center">Slightly Warm</div></div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={comfortData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis yAxisId="left" stroke="#f43f5e" fontSize={10} tickLine={false} axisLine={false} domain={[-3, 3]} />
                      <YAxis yAxisId="right" orientation="right" stroke="#eab308" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                    <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}/>
                      <ReferenceArea y1={-0.5} y2={0.5} yAxisId="left" fill="#22c55e" fillOpacity={0.1} strokeOpacity={0} />
                      <ReferenceLine y={0} yAxisId="left" stroke="#22c55e" strokeDasharray="3 3" opacity={0.5} />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="pmv" 
                        stroke="#f43f5e" 
                        strokeWidth={3} 
                        dot={{ fill: '#0f172a', stroke: '#f43f5e', strokeWidth: 2, r: 3 }} 
                        activeDot={{ r: 5, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                        name="PMV Index" 
                        isAnimationActive={false}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="ppd" 
                        stroke="#eab308" 
                        strokeWidth={2} 
                        strokeDasharray="5 5"
                        dot={false}
                        name="PPD (%)" 
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'cloud' && (
              <div className="flex flex-col h-[280px] w-full bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-2 relative overflow-hidden">
                <div className="flex justify-around items-center px-2 py-1.5 border-b border-slate-700/50 mb-2 shrink-0 bg-slate-800/50 rounded-lg">
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Avg Cloud</div><div className="text-[13px] font-bold text-slate-300 flex items-center gap-1 justify-center">58%<span className="text-[8px] text-emerald-400">↓ 12%</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Max UV</div><div className="text-[13px] font-bold text-orange-400 flex items-center gap-1 justify-center">8.2<span className="text-[8px] text-emerald-400">↓</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Condition</div><div className="text-[13px] font-bold text-blue-300 flex items-center gap-1 justify-center">Partly Cloudy</div></div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cloudData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCloud" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis yAxisId="left" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" fontSize={10} tickLine={false} axisLine={false} domain={[0, 12]} />
                    <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}/>
                      <Area yAxisId="left" type="monotone" dataKey="cover" stroke="#cbd5e1" strokeWidth={2} fill="url(#colorCloud)" name="Cloud Cover" isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="uv" stroke="#fbbf24" strokeWidth={2} dot={{ r: 2, fill: '#fbbf24' }} name="UV Index" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'leaf' && (
              <div className="flex flex-col h-[280px] w-full bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-2 relative overflow-hidden">
                <div className="flex justify-around items-center px-2 py-1.5 border-b border-slate-700/50 mb-2 shrink-0 bg-slate-800/50 rounded-lg">
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Peak AQI</div><div className="text-[13px] font-bold text-emerald-400 flex items-center gap-1 justify-center">72<span className="text-[8px] text-red-400">↑ 15</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">PM2.5 Max</div><div className="text-[13px] font-bold text-purple-400 flex items-center gap-1 justify-center">35 µg/m³<span className="text-[8px] text-red-400">↑</span></div></div>
                  <div className="w-px h-6 bg-slate-700/50" />
                  <div className="text-center"><div className="text-[9px] uppercase tracking-wider text-slate-400">Air Quality</div><div className="text-[13px] font-bold text-emerald-400 flex items-center gap-1 justify-center">Moderate</div></div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={envData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis yAxisId="left" stroke="#10b981" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#a855f7" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}/>
                      <ReferenceLine y={50} yAxisId="left" stroke="#eab308" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Moderate', fill: '#eab308', fontSize: 10 }} />
                      <ReferenceLine y={100} yAxisId="left" stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Unhealthy', fill: '#ef4444', fontSize: 10 }} />
                      <Area yAxisId="left" type="monotone" dataKey="aqi" stroke="#10b981" strokeWidth={2} fill="url(#colorAqi)" name="AQI" isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="pm25" stroke="#a855f7" strokeWidth={2} dot={false} name="PM2.5" isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="pm10" stroke="#f472b6" strokeWidth={2} strokeDasharray="4 4" dot={false} name="PM10" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
