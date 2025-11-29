'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Flame,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  Target
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const tempData = [
  { time: '00', temp: 28, high: 32 },
  { time: '04', temp: 25, high: 28 },
  { time: '08', temp: 32, high: 38 },
  { time: '12', temp: 41, high: 47 },
  { time: '16', temp: 39, high: 44 },
  { time: '20', temp: 33, high: 38 },
  { time: 'Now', temp: 38, high: 45 },
];

export default function ThermalAnalysis() {
  const [coverage, setCoverage] = useState(76);
  const [avgTemp, setAvgTemp] = useState(32.4);
  const [mounted, setMounted] = useState(false);
  const [riskCount] = useState({ high: 1, medium: 2 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setCoverage(prev => Math.min(100, +(prev + Math.random() * 0.3).toFixed(1)));
      setAvgTemp(prev => +(prev + (Math.random() - 0.5) * 0.5).toFixed(1));
    }, 3000);
    return () => clearInterval(interval);
  }, [mounted]);

  return (
    <div className="card-glass h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">Thermal Analysis</h3>
            <p className="text-[10px] text-slate-500">Real-time Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.span className="w-2 h-2 rounded-full bg-orange-500" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          <span className="text-[10px] text-orange-400">Active</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-2 py-2 grid grid-cols-4 gap-2 border-b border-slate-700/30">
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <ThermometerSun className="w-4 h-4 text-orange-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-orange-400 font-mono" suppressHydrationWarning>
            {mounted ? avgTemp.toFixed(1) : '--'}°
          </div>
          <div className="text-[10px] text-slate-500">AVG</div>
        </div>
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <Target className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-cyan-400 font-mono" suppressHydrationWarning>
            {mounted ? coverage.toFixed(0) : '--'}%
          </div>
          <div className="text-[10px] text-slate-500">COV</div>
        </div>
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <Flame className="w-4 h-4 text-red-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-red-400 font-mono">
            {riskCount.high}
          </div>
          <div className="text-[10px] text-slate-500">HIGH</div>
        </div>
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-yellow-400 font-mono">
            {riskCount.medium}
          </div>
          <div className="text-[10px] text-slate-500">MED</div>
        </div>
      </div>

      {/* Mini Chart */}
      <div className="flex-1 px-2 py-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={tempData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                border: '1px solid #334155',
                borderRadius: '6px',
                fontSize: '11px',
                padding: '6px 10px'
              }}
              labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
            />
            <Area type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={1} fillOpacity={1} fill="url(#highGradient)" />
            <Area type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={1.5} fillOpacity={1} fill="url(#tempGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Alerts */}
      <div className="px-2 py-2 border-t border-slate-700/30">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 uppercase">Risk Areas</span>
          <span className="text-[10px] text-slate-500">Last 15min</span>
        </div>
        <div className="space-y-1.5">
          <motion.div 
            className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-white">Central Plaza</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400 font-mono font-bold">47.3°C</span>
              <TrendingUp className="w-3.5 h-3.5 text-red-400" />
            </div>
          </motion.div>
          <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs text-white">Parking Area</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-yellow-400 font-mono font-bold">39.8°C</span>
              <TrendingDown className="w-3.5 h-3.5 text-green-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
