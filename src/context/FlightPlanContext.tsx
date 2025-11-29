'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// 定义航点类型
export interface Waypoint {
  id: string;
  x: number;      // 地图百分比坐标 0-100
  y: number;      // 地图百分比坐标 0-100
  altitude: number;  // 高度 (米)
  lat?: number;   // 纬度 (可选，用于3D)
  lng?: number;   // 经度 (可选，用于3D)
}

// 定义航线类型
export interface FlightPath {
  id: string;
  uavId: string;
  name: string;
  waypoints: Waypoint[];
  color: string;
  status: 'planned' | 'active' | 'completed';
  source: 'manual' | 'agent';  // 来源：手动规划 或 Agent生成
}

// 预定义的区域位置（用于Agent解析）
export const KNOWN_AREAS: Record<string, { x: number, y: number, name: string }> = {
  'central_plaza': { x: 45, y: 30, name: 'Central Plaza' },
  'parking_area': { x: 35, y: 65, name: 'Parking Area' },
  'building_a': { x: 60, y: 25, name: 'Building A' },
  'building_b': { x: 70, y: 45, name: 'Building B' },
  'green_zone': { x: 25, y: 40, name: 'Green Zone' },
  'rooftop': { x: 55, y: 50, name: 'Rooftop Area' },
  'entrance': { x: 50, y: 80, name: 'Main Entrance' },
  'thermal_hotspot': { x: 48, y: 35, name: 'Thermal Hotspot' },
};

// UAV颜色映射
const UAV_COLORS: Record<string, string> = {
  'UAV-01': '#3b82f6',
  'UAV-02': '#ef4444',
  'UAV-03': '#22c55e',
};

// Function Calling 的函数定义
export interface FunctionCall {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export const AVAILABLE_FUNCTIONS: FunctionCall[] = [
  {
    name: 'generate_flight_path',
    description: 'Generate a flight path with waypoints for a UAV around a specified area',
    parameters: {
      type: 'object',
      properties: {
        uav_id: { type: 'string', description: 'UAV identifier (UAV-01, UAV-02, UAV-03)' },
        area: { type: 'string', description: 'Target area name (parking_area, central_plaza, etc.)' },
        num_waypoints: { type: 'number', description: 'Number of waypoints to generate' },
        altitude: { type: 'number', description: 'Flight altitude in meters' },
        pattern: { type: 'string', enum: ['circle', 'grid', 'spiral', 'line'], description: 'Flight pattern type' },
      },
      required: ['uav_id', 'area', 'num_waypoints'],
    },
  },
  {
    name: 'clear_flight_path',
    description: 'Clear/remove a flight path for a specific UAV',
    parameters: {
      type: 'object',
      properties: {
        uav_id: { type: 'string', description: 'UAV identifier' },
      },
      required: ['uav_id'],
    },
  },
  {
    name: 'analyze_thermal_zone',
    description: 'Analyze thermal data for a specific zone',
    parameters: {
      type: 'object',
      properties: {
        zone: { type: 'string', description: 'Zone to analyze' },
      },
      required: ['zone'],
    },
  },
];

interface FlightPlanContextType {
  flightPaths: FlightPath[];
  addFlightPath: (path: FlightPath) => void;
  removeFlightPath: (uavId: string) => void;
  clearAllPaths: () => void;
  // Agent 相关
  executeFunctionCall: (name: string, args: any) => { success: boolean; message: string; data?: any };
  parseUserIntent: (input: string) => { functionName: string | null; args: any; confidence: number };
}

const FlightPlanContext = createContext<FlightPlanContextType | null>(null);

export function FlightPlanProvider({ children }: { children: React.ReactNode }) {
  const [flightPaths, setFlightPaths] = useState<FlightPath[]>([]);

  const addFlightPath = useCallback((path: FlightPath) => {
    setFlightPaths(prev => {
      // 移除同一UAV的旧航线
      const filtered = prev.filter(p => p.uavId !== path.uavId);
      return [...filtered, path];
    });
  }, []);

  const removeFlightPath = useCallback((uavId: string) => {
    setFlightPaths(prev => prev.filter(p => p.uavId !== uavId));
  }, []);

  const clearAllPaths = useCallback(() => {
    setFlightPaths([]);
  }, []);

  // 生成航线的核心函数
  const generateFlightPath = useCallback((
    uavId: string,
    area: string,
    numWaypoints: number,
    altitude: number = 100,
    pattern: string = 'circle'
  ): FlightPath | null => {
    const areaKey = area.toLowerCase().replace(/\s+/g, '_');
    const areaInfo = KNOWN_AREAS[areaKey];
    
    if (!areaInfo) {
      return null;
    }

    const waypoints: Waypoint[] = [];
    const radius = 8 + Math.random() * 4; // 8-12% 的地图范围

    for (let i = 0; i < numWaypoints; i++) {
      let x: number, y: number;
      
      switch (pattern) {
        case 'circle':
          const angle = (2 * Math.PI * i) / numWaypoints;
          x = areaInfo.x + radius * Math.cos(angle);
          y = areaInfo.y + radius * Math.sin(angle);
          break;
        case 'grid':
          const cols = Math.ceil(Math.sqrt(numWaypoints));
          const row = Math.floor(i / cols);
          const col = i % cols;
          x = areaInfo.x - radius + (col * 2 * radius / (cols - 1 || 1));
          y = areaInfo.y - radius + (row * 2 * radius / (cols - 1 || 1));
          break;
        case 'spiral':
          const spiralAngle = (4 * Math.PI * i) / numWaypoints;
          const spiralRadius = (radius * i) / numWaypoints;
          x = areaInfo.x + spiralRadius * Math.cos(spiralAngle);
          y = areaInfo.y + spiralRadius * Math.sin(spiralAngle);
          break;
        case 'line':
        default:
          x = areaInfo.x - radius + (2 * radius * i / (numWaypoints - 1 || 1));
          y = areaInfo.y + (Math.random() - 0.5) * 4;
          break;
      }

      // 确保在地图范围内
      x = Math.max(5, Math.min(95, x));
      y = Math.max(5, Math.min(95, y));

      waypoints.push({
        id: `${uavId}-wp-${i + 1}`,
        x,
        y,
        altitude: altitude + (Math.random() - 0.5) * 20, // 高度有小幅变化
      });
    }

    return {
      id: `path-${uavId}-${Date.now()}`,
      uavId,
      name: `${areaInfo.name} Survey`,
      waypoints,
      color: UAV_COLORS[uavId] || '#06b6d4',
      status: 'planned',
      source: 'agent',
    };
  }, []);

  // 执行Function Call
  const executeFunctionCall = useCallback((name: string, args: any): { success: boolean; message: string; data?: any } => {
    switch (name) {
      // LLM直接生成坐标的新方式
      case 'generate_custom_path': {
        const { uav_id, name: pathName, waypoints } = args;
        
        if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
          return {
            success: false,
            message: `❌ Invalid waypoints data. Expected array of {x, y, altitude} objects.`,
          };
        }

        const formattedWaypoints: Waypoint[] = waypoints.map((wp: any, idx: number) => ({
          id: `${uav_id}-wp-${idx + 1}`,
          x: Math.max(5, Math.min(95, wp.x || 50)),
          y: Math.max(5, Math.min(95, wp.y || 50)),
          altitude: wp.altitude || 100,
        }));

        const path: FlightPath = {
          id: `path-${uav_id}-${Date.now()}`,
          uavId: uav_id,
          name: pathName || 'Custom Flight Path',
          waypoints: formattedWaypoints,
          color: UAV_COLORS[uav_id] || '#06b6d4',
          status: 'planned',
          source: 'agent',
        };

        addFlightPath(path);
        return {
          success: true,
          message: `✅ LLM generated ${formattedWaypoints.length} custom waypoints for ${uav_id}.\n📍 Path: ${pathName || 'Custom Route'}\n🎯 Coordinates determined by AI analysis.`,
          data: path,
        };
      }

      // 保留旧的预设模式方式
      case 'generate_flight_path': {
        const { uav_id, area, num_waypoints, altitude = 100, pattern = 'circle' } = args;
        const path = generateFlightPath(uav_id, area, num_waypoints, altitude, pattern);
        
        if (path) {
          addFlightPath(path);
          return {
            success: true,
            message: `✅ Generated ${num_waypoints} waypoints for ${uav_id} around ${KNOWN_AREAS[area.toLowerCase().replace(/\s+/g, '_')]?.name || area}. Pattern: ${pattern}, Altitude: ${altitude}m.`,
            data: path,
          };
        } else {
          return {
            success: false,
            message: `❌ Unknown area "${area}". Available areas: ${Object.values(KNOWN_AREAS).map(a => a.name).join(', ')}`,
          };
        }
      }
      
      case 'clear_flight_path': {
        const { uav_id } = args;
        removeFlightPath(uav_id);
        return {
          success: true,
          message: `🗑️ Cleared flight path for ${uav_id}.`,
        };
      }
      
      case 'analyze_thermal_zone': {
        const { zone, temperature, risk, recommendation } = args;
        // 使用LLM提供的数据或生成默认值
        const temp = temperature || (35 + Math.random() * 15).toFixed(1);
        const riskLevel = risk || (parseFloat(String(temp)) > 42 ? 'HIGH' : parseFloat(String(temp)) > 38 ? 'MEDIUM' : 'LOW');
        const rec = recommendation || (riskLevel === 'HIGH' ? 'Immediate monitoring required' : 'Continue standard patrol');
        return {
          success: true,
          message: `🌡️ Thermal Analysis for ${zone}:\n- Temperature: ${temp}°C\n- Risk Level: ${riskLevel}\n- ${rec}`,
        };
      }
      
      default:
        return {
          success: false,
          message: `Unknown function: ${name}`,
        };
    }
  }, [addFlightPath, removeFlightPath, generateFlightPath]);

  // 解析用户意图 (模拟NLU)
  const parseUserIntent = useCallback((input: string): { functionName: string | null; args: any; confidence: number } => {
    const lowerInput = input.toLowerCase();
    
    // 检测航线生成意图
    const generatePatterns = [
      /(?:generate|create|plan|make|add)\s+(?:a\s+)?(?:flight\s+)?(?:path|route|waypoints?)\s+(?:for\s+)?(uav[- ]?\d+)/i,
      /(uav[- ]?\d+).*?(\d+)\s*(?:waypoints?|points?)/i,
      /(?:let|have|make)\s+(uav[- ]?\d+)\s+(?:fly|patrol|survey|scan)/i,
    ];
    
    // 检测区域
    const areaPatterns = Object.entries(KNOWN_AREAS).map(([key, val]) => ({
      key,
      patterns: [
        new RegExp(val.name.toLowerCase(), 'i'),
        new RegExp(key.replace(/_/g, '[_ ]?'), 'i'),
      ]
    }));
    
    let detectedUAV: string | null = null;
    let detectedArea: string | null = null;
    let detectedNum = 10; // 默认10个航点
    let detectedAltitude = 100;
    let detectedPattern = 'circle';

    // 提取UAV ID
    const uavMatch = lowerInput.match(/uav[- ]?(\d+)/i);
    if (uavMatch) {
      detectedUAV = `UAV-0${uavMatch[1]}`;
    }

    // 提取航点数量
    const numMatch = lowerInput.match(/(\d+)\s*(?:waypoints?|points?|个航点)/i);
    if (numMatch) {
      detectedNum = parseInt(numMatch[1]);
    }

    // 提取高度
    const altMatch = lowerInput.match(/(\d+)\s*(?:m|米|meters?)\s*(?:altitude|高度)?/i);
    if (altMatch) {
      detectedAltitude = parseInt(altMatch[1]);
    }

    // 提取模式
    if (lowerInput.includes('grid') || lowerInput.includes('网格')) detectedPattern = 'grid';
    else if (lowerInput.includes('spiral') || lowerInput.includes('螺旋')) detectedPattern = 'spiral';
    else if (lowerInput.includes('line') || lowerInput.includes('直线')) detectedPattern = 'line';

    // 检测区域
    for (const { key, patterns } of areaPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(lowerInput)) {
          detectedArea = key;
          break;
        }
      }
      if (detectedArea) break;
    }

    // 检测清除意图
    if (/(?:clear|remove|delete|取消|清除)\s*(?:flight\s+)?(?:path|route|waypoints?)?/i.test(lowerInput) && detectedUAV) {
      return {
        functionName: 'clear_flight_path',
        args: { uav_id: detectedUAV },
        confidence: 0.9,
      };
    }

    // 检测分析意图
    if (/(?:analyze|analysis|分析)\s*(?:thermal|heat|温度|热)/i.test(lowerInput) && detectedArea) {
      return {
        functionName: 'analyze_thermal_zone',
        args: { zone: KNOWN_AREAS[detectedArea]?.name || detectedArea },
        confidence: 0.85,
      };
    }

    // 检测生成航线意图
    if (detectedUAV && detectedArea) {
      return {
        functionName: 'generate_flight_path',
        args: {
          uav_id: detectedUAV,
          area: detectedArea,
          num_waypoints: detectedNum,
          altitude: detectedAltitude,
          pattern: detectedPattern,
        },
        confidence: 0.95,
      };
    }

    // 如果只检测到UAV但没有区域，返回低置信度
    if (detectedUAV && !detectedArea && /(?:generate|create|plan|fly|patrol)/i.test(lowerInput)) {
      return {
        functionName: 'generate_flight_path',
        args: {
          uav_id: detectedUAV,
          area: 'central_plaza', // 默认区域
          num_waypoints: detectedNum,
          altitude: detectedAltitude,
          pattern: detectedPattern,
        },
        confidence: 0.6,
      };
    }

    return { functionName: null, args: {}, confidence: 0 };
  }, []);

  return (
    <FlightPlanContext.Provider value={{
      flightPaths,
      addFlightPath,
      removeFlightPath,
      clearAllPaths,
      executeFunctionCall,
      parseUserIntent,
    }}>
      {children}
    </FlightPlanContext.Provider>
  );
}

export function useFlightPlan() {
  const context = useContext(FlightPlanContext);
  if (!context) {
    throw new Error('useFlightPlan must be used within a FlightPlanProvider');
  }
  return context;
}

