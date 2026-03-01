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
  Area
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

// Mock wind rose data
const windData = [
  { subject: 'North', A: 1.5, fullMark: 3 },
  { subject: 'N-E', A: 0.5, fullMark: 3 },
  { subject: 'East', A: 0.2, fullMark: 3 },
  { subject: 'S-E', A: 0.8, fullMark: 3 },
  { subject: 'South', A: 2.5, fullMark: 3 },
  { subject: 'S-W', A: 1.2, fullMark: 3 },
  { subject: 'West', A: 0.4, fullMark: 3 },
  { subject: 'N-W', A: 0.6, fullMark: 3 },
];

// Mock rain data
const rainData = [
  { day: 'Feb 1', amount: 12 },
  { day: 'Feb 2', amount: 5 },
  { day: 'Feb 3', amount: 0 },
  { day: 'Feb 4', amount: 0 },
  { day: 'Feb 5', amount: 25 },
  { day: 'Feb 6', amount: 18 },
  { day: 'Feb 7', amount: 2 },
];

// Mock thermal comfort (PMV) data
const comfortData = [
  { time: '08:00', pmv: -0.5 },
  { time: '10:00', pmv: 0.2 },
  { time: '12:00', pmv: 1.5 },
  { time: '14:00', pmv: 2.1 },
  { time: '16:00', pmv: 1.8 },
  { time: '18:00', pmv: 0.5 },
  { time: '20:00', pmv: -0.2 },
];

// Mock cloud cover data
const cloudData = [
  { time: '08:00', cover: 20 },
  { time: '10:00', cover: 45 },
  { time: '12:00', cover: 60 },
  { time: '14:00', cover: 80 },
  { time: '16:00', cover: 50 },
  { time: '18:00', cover: 30 },
  { time: '20:00', cover: 10 },
];

// Mock environment (AQI) data
const envData = [
  { day: 'Feb 1', aqi: 45 },
  { day: 'Feb 2', aqi: 52 },
  { day: 'Feb 3', aqi: 68 },
  { day: 'Feb 4', aqi: 74 },
  { day: 'Feb 5', aqi: 42 },
  { day: 'Feb 6', aqi: 35 },
  { day: 'Feb 7', aqi: 50 },
];

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
                <span className="text-slate-100 font-medium">{lastUpdated}</span>
              </div>
              <div className="pt-2">
                <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2 rounded-lg uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] active:scale-95">
                  View Past Data
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
          <div className="min-h-[260px] pb-2">
            <h3 className="text-[15px] font-semibold text-white mb-4 tracking-wide flex items-center gap-2">
              {TABS.find(t => t.id === activeTab)?.label}
            </h3>
            
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
              <div className="h-[280px] w-full flex items-center justify-center bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="45%" cy="50%" outerRadius="70%" data={windData}>
                    <PolarGrid stroke="#475569" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 3]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Radar name="Wind" dataKey="A" stroke="#60a5fa" strokeWidth={2} fill="#3b82f6" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
                {/* Wind legend overlay */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 text-[11px] font-medium text-slate-300 bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-600 shadow-2xl">
                  <div className="flex items-center gap-2.5"><div className="w-4 h-4 rounded-[3px] bg-blue-300 shadow-sm border border-blue-200/50" /> 0-0.5 m/s</div>
                  <div className="flex items-center gap-2.5"><div className="w-4 h-4 rounded-[3px] bg-blue-400 shadow-sm border border-blue-300/50" /> 0.5-1.0 m/s</div>
                  <div className="flex items-center gap-2.5"><div className="w-4 h-4 rounded-[3px] bg-blue-500 shadow-sm border border-blue-400/50" /> 1.0-1.5 m/s</div>
                  <div className="flex items-center gap-2.5"><div className="w-4 h-4 rounded-[3px] bg-blue-600 shadow-sm border border-blue-500/50" /> 1.5-2.0 m/s</div>
                  <div className="flex items-center gap-2.5"><div className="w-4 h-4 rounded-[3px] bg-blue-700 shadow-sm border border-blue-600/50" /> &gt; 2.0 m/s</div>
                </div>
              </div>
            )}

            {activeTab === 'rain' && (
              <div className="h-[280px] w-full flex items-center justify-center bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-4 relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rainData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                    <Tooltip 
                      cursor={{ fill: '#334155', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#60a5fa', fontWeight: 600 }}
                    />
                    <Bar dataKey="amount" fill="url(#colorRain)" radius={[4, 4, 0, 0]} name="Rainfall (mm)" maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'user' && (
              <div className="h-[280px] w-full flex items-center justify-center bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-4 relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comfortData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} domain={[-3, 3]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#f43f5e', fontWeight: 600 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pmv" 
                      stroke="#f43f5e" 
                      strokeWidth={3} 
                      dot={{ fill: '#0f172a', stroke: '#f43f5e', strokeWidth: 2, r: 4 }} 
                      activeDot={{ r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                      name="PMV" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'cloud' && (
              <div className="h-[280px] w-full flex items-center justify-center bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-4 relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cloudData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCloud" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#cbd5e1', fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="cover" stroke="#cbd5e1" strokeWidth={2} fill="url(#colorCloud)" name="Cloud Cover (%)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'leaf' && (
              <div className="h-[280px] w-full flex items-center justify-center bg-slate-800/30 rounded-xl border border-slate-600/40 shadow-inner p-4 relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={envData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#10b981', fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="aqi" stroke="#10b981" strokeWidth={2} fill="url(#colorAqi)" name="AQI" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
