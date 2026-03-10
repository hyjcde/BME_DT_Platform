'use client';

import { RECORDED_FLIGHT_PATHS } from '@/data/recordedFlightPaths';
import { FlightPath as AgentFlightPath, useFlightPlan } from '@/context/FlightPlanContext';
import { useMonitoredData } from '@/context/MonitoredDataContext';
import TestpointDialog from './TestpointDialog';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Droplets,
  Eye,
  EyeOff,
  Gauge,
  Globe,
  Layers,
  Leaf,
  Map,
  MapPin,
  Maximize2,
  Mountain,
  MousePointer,
  Move3d,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Route,
  Thermometer,
  Trash2,
  Video,
  Wand2,
  Wind,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ThreeMap = dynamic(() => import('./ThreeMap'), { ssr: false });

// Types
interface WaypointType {
  id: string;
  x: number;
  y: number;
  lng?: number;
  lat?: number;
  altitude: number;
  order: number;
}

interface FlightPath {
  id: string;
  color: string;
  label: string;
  type: 'coarse' | 'fine' | 'standby';
  points: { x: number; y: number }[];
  currentPosition: { x: number; y: number };
  targetArea?: { x: number; y: number; width: number; height: number };
  status: 'active' | 'standby' | 'returning';
  battery: number;
  altitude: number;
}

interface HeatZone {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  risk: 'high' | 'medium' | 'low';
  temp: number;
  name: string;
}

type ThreeDEngine = 'three' | 'cesium';
type MapLayerId = 'rgb' | 'thermal' | 'ndvi';

// Initial data - IDs match Context format (UAV-01, UAV-02, UAV-03)
const initialFlightPaths: FlightPath[] = [
  {
    id: 'UAV-01',
    color: '#3b82f6',
    label: 'UAV-01',
    type: 'coarse',
    points: [{ x: 85, y: 25 }, { x: 65, y: 25 }, { x: 45, y: 25 }, { x: 25, y: 25 }],
    currentPosition: { x: 85, y: 25 },
    status: 'active',
    battery: 85,
    altitude: 120,
  },
  {
    id: 'UAV-02',
    color: '#ef4444',
    label: 'UAV-02',
    type: 'fine',
    points: [{ x: 15, y: 62 }, { x: 35, y: 62 }, { x: 50, y: 52 }],
    currentPosition: { x: 15, y: 62 },
    targetArea: { x: 38, y: 32, width: 20, height: 22 },
    status: 'active',
    battery: 72,
    altitude: 80,
  },
  {
    id: 'UAV-03',
    color: '#22c55e',
    label: 'UAV-03',
    type: 'standby',
    points: [{ x: 92, y: 28 }, { x: 82, y: 42 }, { x: 82, y: 58 }],
    currentPosition: { x: 92, y: 28 },
    targetArea: { x: 68, y: 38, width: 24, height: 30 },
    status: 'standby',
    battery: 96,
    altitude: 100,
  },
];

// CUHK Campus Heat Zones with real coordinates
// Using direct lng/lat instead of percentage for accuracy
interface HeatZoneGeo {
  id: number;
  lng: number;
  lat: number;
  radius: number;
  risk: 'high' | 'medium' | 'low';
  temp: number;
  name: string;
}

const heatZonesGeo: HeatZoneGeo[] = [
  // High risk - main gathering areas
  { id: 2, lng: 114.2053, lat: 22.4215, radius: 50, risk: 'high', temp: 45.8, name: 'University Library' },
  // Medium risk - Playground (square shape in 3D)
  { id: 3, lng: 114.2095, lat: 22.4165, radius: 55, risk: 'medium', temp: 40.2, name: 'Playground' },
];

// Keep old format for 2D map compatibility
const heatZones: HeatZone[] = [
  { id: 2, x: 40, y: 25, width: 10, height: 10, risk: 'high', temp: 45.8, name: 'University Library' },
  { id: 3, x: 58, y: 47, width: 11, height: 11, risk: 'medium', temp: 40.2, name: 'Playground' },
];

// CUHK Main Campus coordinates: center ~114.2069, 22.4190
// Map bounds: roughly 114.195 to 114.220 (lng), 22.410 to 22.430 (lat)
const MAP_BOUNDS = {
  minLng: 114.195,
  maxLng: 114.220,
  minLat: 22.410,
  maxLat: 22.430,
};

const MAP_LAYER_CONFIG: Record<MapLayerId, {
  id: MapLayerId;
  label: string;
  shortLabel: string;
  description: string;
  src: string;
  accentClasses: string;
  icon: typeof Map;
  legend: 'none' | 'thermal' | 'ndvi';
  available: boolean;
}> = {
  rgb: {
    id: 'rgb',
    label: 'RGB',
    shortLabel: 'RGB',
    description: 'True-color base imagery for orientation and route planning.',
    src: '/rgb.png',
    accentClasses: 'border-slate-300/60 bg-slate-500/20 text-slate-100',
    icon: Map,
    legend: 'none',
    available: true,
  },
  thermal: {
    id: 'thermal',
    label: 'Thermal',
    shortLabel: 'Thermal',
    description: 'Thermal raster for hotspot detection and heat-risk interpretation.',
    src: '/heatmap.png',
    accentClasses: 'border-orange-400/60 bg-orange-500/20 text-orange-100',
    icon: Thermometer,
    legend: 'thermal',
    available: true,
  },
  ndvi: {
    id: 'ndvi',
    label: 'NDVI',
    shortLabel: 'NDVI',
    description: 'Vegetation index (0–1). High values indicate dense, healthy vegetation cover.',
    src: '/ndvi.png',
    accentClasses: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100',
    icon: Leaf,
    legend: 'ndvi',
    available: true,
  },
};

// NDVI time-series: 8 hourly slots from 10:00–17:00
const NDVI_HOURS = [
  { key: '1000', label: '10:00', src: '/ndvi/ndvi_1000.png' },
  { key: '1100', label: '11:00', src: '/ndvi/ndvi_1100.png' },
  { key: '1200', label: '12:00', src: '/ndvi/ndvi_1200.png' },
  { key: '1300', label: '13:00', src: '/ndvi/ndvi_1300.png' },
  { key: '1400', label: '14:00', src: '/ndvi/ndvi_1400.png' },
  { key: '1500', label: '15:00', src: '/ndvi/ndvi_1500.png' },
  { key: '1600', label: '16:00', src: '/ndvi/ndvi_1600.png' },
  { key: '1700', label: '17:00', src: '/ndvi/ndvi_1700.png' },
] as const;

const percentToGeo = (x: number, y: number) => ({
  lng: MAP_BOUNDS.minLng + (x / 100) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng),
  lat: MAP_BOUNDS.maxLat - (y / 100) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat),
});

const geoToPercent = (lng: number, lat: number) => ({
  x: ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100,
  y: ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100,
});

export default function DualModeMap() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const clickHandlerRef = useRef<any>(null);
  const flightPathEntitiesRef = useRef<any[]>([]);
  const agentPathEntitiesRef = useRef<any[]>([]);
  const recordedFlightEntitiesRef = useRef<any[]>([]);
  const testpointEntitiesRef = useRef<any[]>([]); // Testpoint markers in 3D
  const campusModelRef = useRef<any>(null); // Reference to CUHK campus model
  
  // Agent flight paths from context
  const { flightPaths: agentFlightPaths } = useFlightPlan();
  
  // Monitored data from context
  const { 
    testpoints, 
    timeseries,
    currentFrame,
    selectedTestpointId, 
    setSelectedTestpointId, 
    getCurrentValue,
    loading: monitoredDataLoading 
  } = useMonitoredData();

  // Parse current frame timestamp to decimal hour for 3D lighting sync
  const timeOfDay = useMemo(() => {
    if (timeseries.length === 0) return 12;
    const frame = timeseries[currentFrame];
    if (!frame?.timestamp) return 12;
    const parts = frame.timestamp.split(' ');
    const timePart = parts.length >= 2 ? parts[1] : parts[0];
    const [hStr, mStr] = timePart.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h)) return 12;
    return h + (isNaN(m) ? 0 : m / 60);
  }, [timeseries, currentFrame]);
  
  const [mounted, setMounted] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [active3DEngine, setActive3DEngine] = useState<ThreeDEngine>('three');
  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  const [cesiumError, setCesiumError] = useState<string | null>(null);
  const [cesiumInitializing, setCesiumInitializing] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  const [active2DLayer, setActive2DLayer] = useState<MapLayerId>('thermal');
  const [ndviHourIndex, setNdviHourIndex] = useState(0);
  const [ndviPlaying, setNdviPlaying] = useState(false);
  const ndviTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showFlightPaths, setShowFlightPaths] = useState(true);
  const [showHeatZones, setShowHeatZones] = useState(true);
  const [showTestpoints, setShowTestpoints] = useState(true);
  const [isFlying, setIsFlying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  
  const [currentTemp, setCurrentTemp] = useState(41.1);
  const [coordinates] = useState({ lat: 22.4167, lng: 114.2069 });
  const [altitude, setAltitude] = useState(118.76);
  const [speed, setSpeed] = useState(3.2);
  const [windSpeed] = useState(2.1);
  const [hoveredTestpoint, setHoveredTestpoint] = useState<number | null>(null);
  
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  // Flight planning state
  const [flightPaths, setFlightPaths] = useState<FlightPath[]>(initialFlightPaths);
  const [selectedUAV, setSelectedUAV] = useState<string | null>(null);

  // Merge flight paths: Agent paths replace original UAV paths
  const mergedFlightPaths = useMemo(() => {
    // Create a lookup object for agent paths by UAV ID
    const agentPathLookup: Record<string, AgentFlightPath> = {};
    agentFlightPaths.forEach(ap => { agentPathLookup[ap.uavId] = ap; });
    
    // For each original flight path, check if there's an agent replacement
    return flightPaths.map(originalPath => {
      const agentPath = agentPathLookup[originalPath.id];
      if (agentPath) {
        // Replace with agent-generated path, keeping UAV metadata
        return {
          ...originalPath,
          points: agentPath.waypoints.map(wp => ({ x: wp.x, y: wp.y })),
          currentPosition: agentPath.waypoints[0] 
            ? { x: agentPath.waypoints[0].x, y: agentPath.waypoints[0].y }
            : originalPath.currentPosition,
          altitude: agentPath.waypoints[0]?.altitude || originalPath.altitude,
          isAgentGenerated: true as const,
          agentPathName: agentPath.name,
        };
      }
      return { ...originalPath, isAgentGenerated: false as const };
    });
  }, [flightPaths, agentFlightPaths]);
  const [planningMode, setPlanningMode] = useState(false);
  const [waypoints, setWaypoints] = useState<WaypointType[]>([]);
  const [showPlanningPanel, setShowPlanningPanel] = useState(false);
  const waypointEntitiesRef = useRef<any[]>([]);
  const [defaultWaypointAltitude, setDefaultWaypointAltitude] = useState(100);
  
  // 3D camera controls
  const [cameraHeight, setCameraHeight] = useState(1500);
  const [cameraPitch, setCameraPitch] = useState(-45);

  const recordedFlightOverlayPaths = useMemo(() => {
    return RECORDED_FLIGHT_PATHS.map((path) => ({
      ...path,
      percentPoints: path.points.map((point) => ({
        ...point,
        ...geoToPercent(point.lng, point.lat),
      })),
    }));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isFlying) return;
    const interval = setInterval(() => {
      setAnimationProgress(prev => (prev + 0.5) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, [mounted, isFlying]);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setCurrentTemp(prev => +(prev + (Math.random() - 0.5) * 0.5).toFixed(1));
      setAltitude(prev => +(prev + (Math.random() - 0.5) * 2).toFixed(2));
      setSpeed(prev => Math.max(0, +(prev + (Math.random() - 0.5) * 0.3).toFixed(1)));
    }, 2000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Camera control functions
  const adjustCameraHeight = useCallback((delta: number) => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const newHeight = Math.max(200, Math.min(5000, cameraHeight + delta));
    setCameraHeight(newHeight);
    
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4167, newHeight),
      orientation: { heading: viewerRef.current.camera.heading, pitch: Cesium.Math.toRadians(cameraPitch), roll: 0 },
      duration: 0.5,
    });
  }, [cameraHeight, cameraPitch]);

  const adjustCameraPitch = useCallback((delta: number) => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const newPitch = Math.max(-90, Math.min(-10, cameraPitch + delta));
    setCameraPitch(newPitch);
    
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4167, cameraHeight),
      orientation: { heading: viewerRef.current.camera.heading, pitch: Cesium.Math.toRadians(newPitch), roll: 0 },
      duration: 0.5,
    });
  }, [cameraHeight, cameraPitch]);

  const resetCamera = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    setCameraHeight(1500);
    setCameraPitch(-45);
    
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4190, 1500),
      orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration: 1,
    });
  }, []);

  // Focus on CUHK Campus Model - fly to correct CUHK location
  const focusOnCampusModel = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) {
      console.log('Viewer not ready');
      return;
    }
    const Cesium = cesiumRef.current;
    
    // Always fly to CUHK campus coordinates
    const longitude = 114.2069;
    const latitude = 22.4190;
    const cameraDistance = 1500; // meters above ground
    
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, cameraDistance),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60), // Looking down
        roll: 0
      },
      duration: 2,
    });
    console.log('Flying to CUHK campus');
  }, []);

  const addWaypoint = useCallback((x: number, y: number, lng?: number, lat?: number) => {
    const newWaypoint: WaypointType = {
      id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      lng, lat,
      altitude: defaultWaypointAltitude,
      order: waypoints.length + 1,
    };
    setWaypoints(prev => [...prev, newWaypoint]);
    return newWaypoint;
  }, [waypoints.length, defaultWaypointAltitude]);

  // Update waypoint altitude
  const updateWaypointAltitude = useCallback((id: string, newAltitude: number) => {
    setWaypoints(prev => prev.map(wp => 
      wp.id === id ? { ...wp, altitude: Math.max(20, Math.min(500, newAltitude)) } : wp
    ));
  }, []);

  const updateCesiumWaypoints = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    
    // Check if viewer is destroyed
    if (viewer.isDestroyed()) return;
    
    // Clear old entities
    waypointEntitiesRef.current.forEach(entity => {
      try { 
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity); 
        }
      } catch (e) { /* ignore */ }
    });
    waypointEntitiesRef.current = [];
    
    waypoints.forEach((wp, i) => {
      try {
        const geo = wp.lng && wp.lat ? { lng: wp.lng, lat: wp.lat } : percentToGeo(wp.x, wp.y);
        
        // Waypoint point
        const pointEntity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(geo.lng, geo.lat, wp.altitude),
          point: { pixelSize: 14, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
          label: { 
            text: `${i + 1}\n${wp.altitude}m`, 
            font: 'bold 11px sans-serif', 
            fillColor: Cesium.Color.WHITE, 
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            showBackground: true,
            backgroundColor: Cesium.Color.CYAN.withAlpha(0.8),
            backgroundPadding: new Cesium.Cartesian2(6, 4),
          },
        });
        waypointEntitiesRef.current.push(pointEntity);
        
        // Vertical line to ground
        const groundLineEntity = viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([geo.lng, geo.lat, 0, geo.lng, geo.lat, wp.altitude]),
            width: 1,
            material: Cesium.Color.CYAN.withAlpha(0.5),
          },
        });
        waypointEntitiesRef.current.push(groundLineEntity);
        
        // Path line to previous waypoint
        if (i > 0) {
          const prevWp = waypoints[i-1];
          const prevGeo = prevWp.lng && prevWp.lat ? { lng: prevWp.lng, lat: prevWp.lat } : percentToGeo(prevWp.x, prevWp.y);
          const lineEntity = viewer.entities.add({
            polyline: { 
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                prevGeo.lng, prevGeo.lat, prevWp.altitude, 
                geo.lng, geo.lat, wp.altitude
              ]), 
              width: 3, 
              material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.CYAN, dashLength: 16 }) 
            },
          });
          waypointEntitiesRef.current.push(lineEntity);
        }
      } catch (err) {
        console.warn('Error adding waypoint entity:', err);
      }
    });
  }, [waypoints]);

  useEffect(() => {
    if (is3DMode && cesiumLoaded) updateCesiumWaypoints();
  }, [waypoints, is3DMode, cesiumLoaded, updateCesiumWaypoints]);

  const setupCesiumClickHandler = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    
    if (clickHandlerRef.current) { clickHandlerRef.current.destroy(); clickHandlerRef.current = null; }
    
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // Click handler
    handler.setInputAction((click: any) => {
      // First check if clicked on a testpoint entity
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entityId = pickedObject.id.id || pickedObject.id._id;
        if (entityId && entityId.startsWith('testpoint-marker-')) {
          const tpId = parseInt(entityId.replace('testpoint-marker-', ''));
          if (!isNaN(tpId)) {
            window.dispatchEvent(new CustomEvent('cesium-testpoint-click', { detail: { testpointId: tpId } }));
            return;
          }
        }
      }
      
      // Otherwise handle as ground click for waypoint planning
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const { x, y } = geoToPercent(lng, lat);
        window.dispatchEvent(new CustomEvent('cesium-click', { detail: { x, y, lng, lat } }));
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    clickHandlerRef.current = handler;
  }, []);

  useEffect(() => {
    const handleCesiumClick = (e: CustomEvent) => {
      if (planningMode && selectedUAV) {
        const { x, y, lng, lat } = e.detail;
        addWaypoint(x, y, lng, lat);
      }
    };
    
    const handleTestpointClick = (e: CustomEvent) => {
      const { testpointId } = e.detail;
      if (!planningMode) {
        setSelectedTestpointId(selectedTestpointId === testpointId ? null : testpointId);
      }
    };
    
    window.addEventListener('cesium-click', handleCesiumClick as EventListener);
    window.addEventListener('cesium-testpoint-click', handleTestpointClick as EventListener);
    return () => {
      window.removeEventListener('cesium-click', handleCesiumClick as EventListener);
      window.removeEventListener('cesium-testpoint-click', handleTestpointClick as EventListener);
    };
  }, [planningMode, selectedUAV, addWaypoint, selectedTestpointId, setSelectedTestpointId]);

  const initCesium = useCallback(async () => {
    if (!cesiumContainerRef.current || cesiumLoaded || cesiumInitializing) return;
    setCesiumInitializing(true);
    setCesiumError(null);

    try {
      const Cesium = await import('cesium');
      cesiumRef.current = Cesium;
      (window as any).CESIUM_BASE_URL = '/cesium/';
      await import('cesium/Build/Cesium/Widgets/widgets.css');

      const basemapProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/WGS84/{z}/{x}/{y}.png',
        credit: new Cesium.Credit('Map from Lands Department'),
      });

      const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
        baseLayer: new Cesium.ImageryLayer(basemapProvider),
        baseLayerPicker: false, timeline: false, animation: false, vrButton: false, fullscreenButton: false,
        homeButton: false, navigationHelpButton: false, geocoder: false, sceneModePicker: false,
        selectionIndicator: false, infoBox: false, requestRenderMode: false, targetFrameRate: 60,
      });

      const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
      if (creditContainer) creditContainer.style.display = 'none';

      viewerRef.current = viewer;
      addCesiumEntities(viewer, Cesium);

      // Camera view for CUHK Main Campus
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4190, cameraHeight),
        orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(cameraPitch), roll: 0 },
      });

      setupCesiumClickHandler();
      setCesiumLoaded(true);
    } catch (error) {
      console.error('Cesium init error:', error);
      setCesiumError('Failed to initialize 3D view');
    } finally {
      setCesiumInitializing(false);
    }
  }, [cesiumLoaded, cesiumInitializing, setupCesiumClickHandler, cameraHeight, cameraPitch]);

  const addCesiumEntities = async (viewer: any, Cesium: any) => {
    // Load CUHK Campus from Cesium ion
    setModelLoading(true);
    try {
      console.log('Loading CUHK Campus from Cesium ion...');
      
      // Set Cesium ion access token
      Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjMzQyNjJlOS0xMGZlLTQ2NzctYjdhYi0zZjM4NDkyMWM0ZjEiLCJpZCI6MTIwNTA5LCJpYXQiOjE2NzI5OTE1ODd9.xcQ46k8Ng1tBILRSptcG2h4l4vxHU_vdZePrfsOBqJA';
      
      // Load tileset from Cesium ion
      const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(4181808);
      viewer.scene.primitives.add(tileset);
      campusModelRef.current = tileset;
      
      console.log('CUHK Campus loaded from Cesium ion');
      
      // Model is at wrong location, need to reposition
      // Actual: lng=122.763, lat=29.598, height=108790m
      // Target: lng=114.2069, lat=22.4190, height=0m
      
      const actualLng = 122.7630496218366;
      const actualLat = 29.598303913366102;
      const actualHeight = 108790.14754517419;
      
      const targetLng = 114.2069;
      const targetLat = 22.4190;
      const targetHeight = 15; // Raise model slightly above ground
      
      // Calculate offset in ECEF coordinates
      const actualPosition = Cesium.Cartesian3.fromDegrees(actualLng, actualLat, actualHeight);
      const targetPosition = Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight);
      const offset = Cesium.Cartesian3.subtract(targetPosition, actualPosition, new Cesium.Cartesian3());
      
      // Apply offset to tileset model matrix
      const offsetMatrix = Cesium.Matrix4.fromTranslation(offset);
      Cesium.Matrix4.multiply(offsetMatrix, tileset.modelMatrix, tileset.modelMatrix);
      
      console.log('Model repositioned to CUHK campus');
      console.log('Offset applied:', offset);
      
      setModelLoading(false);
      setModelLoaded(true);
      
      // Fly to CUHK campus
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, 1500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        },
        duration: 2,
      });
      
    } catch (error) {
      console.error('Failed to load CUHK Campus from ion:', error);
      console.log('This may be a temporary network issue. Try refreshing the page.');
      setModelLoading(false);
      setModelLoaded(false);
      
      // Add a marker at CUHK location
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(114.2069, 22.4190, 100),
        point: { pixelSize: 15, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
        label: { 
          text: 'CUHK Campus\n(Model loading failed - check network)', 
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.RED.withAlpha(0.7),
        },
      });
      
      // Fallback: fly to CUHK without model
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4190, 1500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        },
        duration: 2,
      });
    }

    // Add heat zones with real CUHK coordinates
    heatZonesGeo.forEach((zone, index) => {
      const position = Cesium.Cartesian3.fromDegrees(zone.lng, zone.lat, 0);
      
      // Colors based on risk level
      const fillColor = zone.risk === 'high' 
        ? Cesium.Color.RED.withAlpha(0.45) 
        : zone.risk === 'medium' 
        ? Cesium.Color.ORANGE.withAlpha(0.4) 
        : Cesium.Color.LIME.withAlpha(0.35);
      
      const outlineColor = zone.risk === 'high' 
        ? Cesium.Color.RED 
        : zone.risk === 'medium' 
        ? Cesium.Color.ORANGE 
        : Cesium.Color.LIME;
      
      // Playground uses box shape, others use cylinder
      if (zone.name === 'Playground') {
        // Box for Playground (square shape)
        const boxSize = zone.radius * 1.6; // Make it roughly similar size
        viewer.entities.add({
          name: zone.name,
          position: Cesium.Cartesian3.fromDegrees(zone.lng, zone.lat, 60),
          box: {
            dimensions: new Cesium.Cartesian3(boxSize, boxSize, 120),
            material: fillColor,
            outline: true,
            outlineColor: outlineColor,
            outlineWidth: 2,
          },
          label: {
            text: `${zone.name}\n${zone.temp}°C`,
            font: 'bold 14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -70),
            showBackground: true,
            backgroundColor: outlineColor.withAlpha(0.85),
            backgroundPadding: new Cesium.Cartesian2(10, 6),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        
        // Ground rectangle for Playground
        viewer.entities.add({
          position: position,
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
              zone.lng - 0.0004,
              zone.lat - 0.0004,
              zone.lng + 0.0004,
              zone.lat + 0.0004
            ),
            material: outlineColor.withAlpha(0.15),
            outline: true,
            outlineColor: outlineColor.withAlpha(0.7),
            outlineWidth: 2,
            height: 1,
          },
        });
      } else {
        // Cylinder for other zones
        viewer.entities.add({
          name: zone.name,
          position: Cesium.Cartesian3.fromDegrees(zone.lng, zone.lat, 60),
          cylinder: {
            length: 120,
            topRadius: zone.radius * 0.8,
            bottomRadius: zone.radius,
            material: fillColor,
            outline: true,
            outlineColor: outlineColor,
            outlineWidth: 2,
          },
          label: {
            text: `${zone.name}\n${zone.temp}°C`,
            font: 'bold 14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -70),
            showBackground: true,
            backgroundColor: outlineColor.withAlpha(0.85),
            backgroundPadding: new Cesium.Cartesian2(10, 6),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        
        // Ground circle for non-Playground zones
        viewer.entities.add({
          position: position,
          ellipse: {
            semiMajorAxis: zone.radius,
            semiMinorAxis: zone.radius,
            material: outlineColor.withAlpha(0.15),
            outline: true,
            outlineColor: outlineColor.withAlpha(0.7),
            outlineWidth: 2,
            height: 1,
          },
        });
      }
    });
  };

  // Update flight paths in 3D view
  const updateCesiumFlightPaths = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;

    // Check if viewer is destroyed
    if (viewer.isDestroyed()) return;

    // Clear old flight path entities
    flightPathEntitiesRef.current.forEach(e => {
      try { 
        if (viewer.entities.contains(e)) {
          viewer.entities.remove(e); 
        }
      } catch (err) { /* ignore */ }
    });
    flightPathEntitiesRef.current = [];

    if (!showFlightPaths) return;

    // Remove any existing entities with same IDs first
    mergedFlightPaths.forEach((path) => {
      const existingIds = [`uav-${path.id}`, `path-${path.id}`];
      path.points.forEach((_, idx) => existingIds.push(`waypoint-${path.id}-${idx}`));
      existingIds.forEach(id => {
        const existing = viewer.entities.getById(id);
        if (existing) {
          try { viewer.entities.remove(existing); } catch (e) { /* ignore */ }
        }
      });
    });

    // Add new flight path entities
    mergedFlightPaths.forEach((path) => {
      const isAgent = (path as any).isAgentGenerated;
      const uavColor = isAgent ? Cesium.Color.fromCssColorString('#a855f7') : (path.type === 'coarse' ? Cesium.Color.BLUE : path.type === 'fine' ? Cesium.Color.RED : Cesium.Color.GREEN);
      const geo = percentToGeo(path.currentPosition.x, path.currentPosition.y);
      
      try {
        // UAV current position marker
        const uavEntity = viewer.entities.add({
          id: `uav-${path.id}`,
          position: Cesium.Cartesian3.fromDegrees(geo.lng, geo.lat, path.altitude),
          point: { pixelSize: 16, color: uavColor, outlineColor: Cesium.Color.WHITE, outlineWidth: 3 },
          label: { text: path.label, font: '14px monospace', fillColor: uavColor, style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2, outlineColor: Cesium.Color.BLACK, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -20), showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.7), backgroundPadding: new Cesium.Cartesian2(8, 4) },
        });
        flightPathEntitiesRef.current.push(uavEntity);

        if (path.points.length > 0) {
          // Draw path line
          const pathPositions = path.points.flatMap(p => { const g = percentToGeo(p.x, p.y); return [g.lng, g.lat, path.altitude]; });
          const pathEntity = viewer.entities.add({ 
            id: `path-${path.id}`,
            polyline: { positions: Cesium.Cartesian3.fromDegreesArrayHeights(pathPositions), width: 4, material: new Cesium.PolylineDashMaterialProperty({ color: uavColor.withAlpha(0.9), dashLength: 20 }) } 
          });
          flightPathEntitiesRef.current.push(pathEntity);

          // Add waypoint markers with sequence numbers
          path.points.forEach((point, index) => {
            const pointGeo = percentToGeo(point.x, point.y);
            const waypointEntity = viewer.entities.add({
              id: `waypoint-${path.id}-${index}`,
              position: Cesium.Cartesian3.fromDegrees(pointGeo.lng, pointGeo.lat, path.altitude),
              point: { 
                pixelSize: 10, 
                color: uavColor.withAlpha(0.8), 
                outlineColor: Cesium.Color.WHITE, 
                outlineWidth: 2 
              },
              label: { 
                text: `${index + 1}`, 
                font: 'bold 11px sans-serif', 
                fillColor: Cesium.Color.WHITE, 
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: uavColor,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                pixelOffset: new Cesium.Cartesian2(0, -18),
                showBackground: true,
                backgroundColor: uavColor.withAlpha(0.9),
                backgroundPadding: new Cesium.Cartesian2(4, 2),
              },
            });
            flightPathEntitiesRef.current.push(waypointEntity);
          });
        }
      } catch (err) {
        console.warn('Error adding flight path entity:', err);
      }
    });
  }, [mergedFlightPaths, showFlightPaths]);

  // Update Cesium Agent flight paths (from LLM Agent) - Now handled by mergedFlightPaths
  const updateCesiumAgentPaths = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;

    if (viewer.isDestroyed()) return;

    // Clear existing agent path entities
    agentPathEntitiesRef.current.forEach(e => {
      try { 
        if (viewer.entities.contains(e)) {
          viewer.entities.remove(e); 
        }
      } catch (err) { /* ignore */ }
    });
    agentPathEntitiesRef.current = [];

    if (!showFlightPaths) return;

    // Add agent flight paths
    agentFlightPaths.forEach((agentPath) => {
      try {
        if (agentPath.waypoints.length === 0) return;

        // Convert waypoints to Cesium positions
        const positions: number[] = [];
        agentPath.waypoints.forEach(wp => {
          const geo = percentToGeo(wp.x, wp.y);
          positions.push(geo.lng, geo.lat, wp.altitude);
        });

        // Add path polyline with glow effect
        const pathEntity = viewer.entities.add({
          id: `agent-path-${agentPath.id}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
            width: 4,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.fromCssColorString(agentPath.color).withAlpha(0.9),
            }),
            clampToGround: false,
          },
        });
        agentPathEntitiesRef.current.push(pathEntity);

        // Add waypoint markers with labels
        agentPath.waypoints.forEach((wp, idx) => {
          const geo = percentToGeo(wp.x, wp.y);
          
          const waypointEntity = viewer.entities.add({
            id: `agent-wp-${agentPath.id}-${idx}`,
            position: Cesium.Cartesian3.fromDegrees(geo.lng, geo.lat, wp.altitude),
            point: {
              pixelSize: 10,
              color: Cesium.Color.fromCssColorString(agentPath.color),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.NONE,
            },
            label: {
              text: `${idx + 1}`,
              font: '12px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              heightReference: Cesium.HeightReference.NONE,
            },
          });
          agentPathEntitiesRef.current.push(waypointEntity);
        });

        // Add AGENT badge at first waypoint
        const firstWp = agentPath.waypoints[0];
        const firstGeo = percentToGeo(firstWp.x, firstWp.y);
        const badgeEntity = viewer.entities.add({
          id: `agent-badge-${agentPath.id}`,
          position: Cesium.Cartesian3.fromDegrees(firstGeo.lng, firstGeo.lat, firstWp.altitude + 30),
          label: {
            text: `🤖 ${agentPath.uavId} (AGENT)`,
            font: 'bold 14px sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#a855f7'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.NONE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#1e1b4b').withAlpha(0.9),
            backgroundPadding: new Cesium.Cartesian2(8, 5),
          },
        });
        agentPathEntitiesRef.current.push(badgeEntity);

      } catch (err) {
        console.warn('Error adding agent path entity:', err);
      }
    });
  }, [agentFlightPaths, showFlightPaths]);

  const updateCesiumRecordedFlightPaths = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;

    if (viewer.isDestroyed()) return;

    recordedFlightEntitiesRef.current.forEach((entity) => {
      try {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity);
        }
      } catch (err) { /* ignore */ }
    });
    recordedFlightEntitiesRef.current = [];

    if (!showFlightPaths) return;

    RECORDED_FLIGHT_PATHS.forEach((path) => {
      try {
        const pathColor = Cesium.Color.fromCssColorString(path.color);
        const positions = path.points.flatMap((point) => [point.lng, point.lat, point.altitude]);

        const lineEntity = viewer.entities.add({
          id: `recorded-path-${path.id}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
              color: pathColor.withAlpha(0.95),
              dashLength: 14,
            }),
            clampToGround: false,
          },
        });
        recordedFlightEntitiesRef.current.push(lineEntity);

        const startPoint = path.points[0];
        const endPoint = path.points[path.points.length - 1];
        const centerPoint = path.points[Math.floor(path.points.length / 2)] ?? startPoint;
        if (!startPoint || !endPoint || !centerPoint) return;

        const startEntity = viewer.entities.add({
          id: `recorded-start-${path.id}`,
          position: Cesium.Cartesian3.fromDegrees(startPoint.lng, startPoint.lat, startPoint.altitude),
          point: {
            pixelSize: 12,
            color: pathColor,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
          },
        });
        recordedFlightEntitiesRef.current.push(startEntity);

        const endEntity = viewer.entities.add({
          id: `recorded-end-${path.id}`,
          position: Cesium.Cartesian3.fromDegrees(endPoint.lng, endPoint.lat, endPoint.altitude),
          point: {
            pixelSize: 11,
            color: Cesium.Color.WHITE,
            outlineColor: pathColor,
            outlineWidth: 3,
          },
        });
        recordedFlightEntitiesRef.current.push(endEntity);

        const labelEntity = viewer.entities.add({
          id: `recorded-label-${path.id}`,
          position: Cesium.Cartesian3.fromDegrees(centerPoint.lng, centerPoint.lat, centerPoint.altitude + 18),
          label: {
            text: `${path.id} • ${path.pointCount} pts`,
            font: 'bold 12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: pathColor,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.72),
            backgroundPadding: new Cesium.Cartesian2(8, 4),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        recordedFlightEntitiesRef.current.push(labelEntity);
      } catch (err) {
        console.warn('Error adding recorded flight path:', err);
      }
    });
  }, [showFlightPaths]);

  useEffect(() => {
    if (is3DMode && active3DEngine === 'cesium' && mounted && !cesiumLoaded && !cesiumInitializing) {
      initCesium();
    }
  }, [is3DMode, active3DEngine, mounted, cesiumLoaded, cesiumInitializing, initCesium]);

  // Destroy Cesium when switching to 2D mode
  useEffect(() => {
    if ((!is3DMode || active3DEngine !== 'cesium') && cesiumLoaded) {
      // Clean up Cesium when switching to 2D
      if (clickHandlerRef.current) {
        clickHandlerRef.current.destroy();
        clickHandlerRef.current = null;
      }
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      flightPathEntitiesRef.current = [];
      waypointEntitiesRef.current = [];
      agentPathEntitiesRef.current = [];
      recordedFlightEntitiesRef.current = [];
      testpointEntitiesRef.current = [];
      setCesiumLoaded(false);
      setCesiumInitializing(false);
    }
  }, [is3DMode, active3DEngine, cesiumLoaded]);

  // Update 3D flight paths when flightPaths change or when switching to 3D mode
  useEffect(() => {
    if (is3DMode && active3DEngine === 'cesium' && cesiumLoaded && viewerRef.current && !viewerRef.current.isDestroyed()) {
      updateCesiumFlightPaths();
    }
  }, [is3DMode, active3DEngine, cesiumLoaded, mergedFlightPaths, updateCesiumFlightPaths]);

  // Update 3D Agent flight paths when agentFlightPaths change
  useEffect(() => {
    if (is3DMode && active3DEngine === 'cesium' && cesiumLoaded && viewerRef.current && !viewerRef.current.isDestroyed()) {
      updateCesiumAgentPaths();
    }
  }, [is3DMode, active3DEngine, cesiumLoaded, agentFlightPaths, updateCesiumAgentPaths]);

  useEffect(() => {
    if (is3DMode && active3DEngine === 'cesium' && cesiumLoaded && viewerRef.current && !viewerRef.current.isDestroyed()) {
      updateCesiumRecordedFlightPaths();
    }
  }, [is3DMode, active3DEngine, cesiumLoaded, showFlightPaths, updateCesiumRecordedFlightPaths]);

  // Update 3D Testpoint markers
  const updateCesiumTestpoints = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current || !showTestpoints) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;

    if (viewer.isDestroyed()) return;

    // Clear existing testpoint entities
    testpointEntitiesRef.current.forEach(e => {
      try { 
        if (viewer.entities.contains(e)) {
          viewer.entities.remove(e); 
        }
      } catch (err) { /* ignore */ }
    });
    testpointEntitiesRef.current = [];

    // Add testpoint markers
    testpoints.forEach((tp) => {
      // Skip testpoints without data
      if (!tp.statistics || Object.keys(tp.statistics).length === 0) return;
      
      try {
        const isSelected = selectedTestpointId === tp.id;
        const currentTemp = getDisplayTemperature(tp);
        const currentRH = getDisplayHumidity(tp);
        
        // Get device color
        const deviceColors: Record<string, string> = {
          'HOBO MX': '#3b82f6',
          'Weather Station': '#22c55e',
          'Thermocouple': '#f59e0b',
          'Radiation Tracker': '#a855f7',
        };
        const color = deviceColors[tp.device_type] || '#6b7280';
        const cesiumColor = Cesium.Color.fromCssColorString(color);
        
        // Vertical pole from ground - taller for better visibility
        const poleEntity = viewer.entities.add({
          id: `testpoint-pole-${tp.id}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              tp.lng, tp.lat, 5,
              tp.lng, tp.lat, 80
            ]),
            width: isSelected ? 5 : 3,
            material: cesiumColor.withAlpha(isSelected ? 1 : 0.8),
          },
        });
        testpointEntitiesRef.current.push(poleEntity);
        
        // Clickable marker billboard at top - larger and with prominent ID
        const markerEntity = viewer.entities.add({
          id: `testpoint-marker-${tp.id}`,
          position: Cesium.Cartesian3.fromDegrees(tp.lng, tp.lat, 80),
          billboard: {
            image: createTestpointIcon(tp.id, color, isSelected),
            width: isSelected ? 48 : 36,
            height: isSelected ? 48 : 36,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 5000, 0.5),
          },
        });
        testpointEntitiesRef.current.push(markerEntity);
        
        // Data label showing temp/humidity - always show ID, show details on select
        let labelText = isSelected 
          ? `[${tp.id}] ${tp.location_name}\n${tp.device_type}`
          : `${tp.id}`;
        if (isSelected && currentTemp != null) {
          labelText += `\n${currentTemp.toFixed(1)}°C`;
          if (currentRH != null) {
            labelText += ` | ${currentRH.toFixed(0)}%`;
          }
        }
        
        const labelEntity = viewer.entities.add({
          id: `testpoint-label-${tp.id}`,
          position: Cesium.Cartesian3.fromDegrees(tp.lng, tp.lat, isSelected ? 120 : 95),
          label: {
            text: labelText,
            font: isSelected ? 'bold 13px sans-serif' : 'bold 14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 3,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            showBackground: true,
            backgroundColor: isSelected ? cesiumColor.withAlpha(0.95) : Cesium.Color.BLACK.withAlpha(0.7),
            backgroundPadding: new Cesium.Cartesian2(isSelected ? 10 : 6, isSelected ? 8 : 4),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            pixelOffset: new Cesium.Cartesian2(0, -5),
          },
        });
        testpointEntitiesRef.current.push(labelEntity);
        
      } catch (err) {
        console.warn('Error adding testpoint entity:', err);
      }
    });
  }, [testpoints, selectedTestpointId, showTestpoints, getCurrentValue]);

  // Helper function to create testpoint icon
  const createTestpointIcon = (id: number, color: string, isSelected: boolean) => {
    const size = isSelected ? 48 : 36;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Draw circle background
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 2, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw white border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = isSelected ? 4 : 3;
    ctx.stroke();
    
    // Draw ID number
    ctx.fillStyle = 'white';
    ctx.font = `bold ${isSelected ? 20 : 16}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id.toString(), size/2, size/2);
    
    return canvas.toDataURL();
  };

  // Update testpoints in 3D when data changes
  useEffect(() => {
    if (is3DMode && active3DEngine === 'cesium' && cesiumLoaded && viewerRef.current && !viewerRef.current.isDestroyed()) {
      updateCesiumTestpoints();
    }
  }, [is3DMode, active3DEngine, cesiumLoaded, testpoints, selectedTestpointId, showTestpoints, updateCesiumTestpoints]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clickHandlerRef.current) { clickHandlerRef.current.destroy(); clickHandlerRef.current = null; }
      if (viewerRef.current && !viewerRef.current.isDestroyed()) { viewerRef.current.destroy(); viewerRef.current = null; }
    };
  }, []);

  const removeWaypoint = (id: string) => setWaypoints(prev => prev.filter(wp => wp.id !== id).map((wp, i) => ({ ...wp, order: i + 1 })));

  const clearWaypointEntities = useCallback(() => {
    if (viewerRef.current) {
      waypointEntitiesRef.current.forEach(e => {
        try { viewerRef.current.entities.remove(e); } catch (err) { /* ignore */ }
      });
    }
    waypointEntitiesRef.current = [];
  }, []);

  const applyPlannedRoute = () => {
    if (!selectedUAV || waypoints.length === 0) return;
    setFlightPaths(prev => prev.map(path => path.id === selectedUAV ? { ...path, points: waypoints.map(wp => ({ x: wp.x, y: wp.y })), currentPosition: { x: waypoints[0].x, y: waypoints[0].y } } : path));
    clearWaypointEntities();
    setWaypoints([]); setPlanningMode(false); setShowPlanningPanel(false); setSelectedUAV(null);
  };

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!planningMode || !selectedUAV) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    addWaypoint(x, y);
  }, [planningMode, selectedUAV, addWaypoint]);

  const getAnimatedPosition = (path: FlightPath) => {
    if (!isFlying || path.points.length < 2) return path.currentPosition;
    const totalSegments = path.points.length - 1;
    const progressPerSegment = 100 / totalSegments;
    const currentSegment = Math.min(Math.floor(animationProgress / progressPerSegment), totalSegments - 1);
    const segmentProgress = (animationProgress % progressPerSegment) / progressPerSegment;
    const start = path.points[currentSegment];
    const end = path.points[currentSegment + 1] || path.points[currentSegment];
    return { x: start.x + (end.x - start.x) * segmentProgress, y: start.y + (end.y - start.y) * segmentProgress };
  };

  const getRiskStyle = (risk: string) => {
    switch (risk) {
      case 'high': return { bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444' };
      case 'medium': return { bg: 'rgba(251, 191, 36, 0.20)', border: '#fbbf24' };
      case 'low': return { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e' };
      default: return { bg: 'rgba(100, 116, 139, 0.1)', border: '#64748b' };
    }
  };

  const glassControlPanelClass = 'rounded-2xl border border-white/10 bg-black/55 p-1 backdrop-blur-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)]';
  const controlButtonBaseClass = 'relative flex items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-[10px] font-medium transition-all duration-200';
  const inactiveControlButtonClass = 'border-white/8 bg-white/6 text-slate-300 hover:border-white/15 hover:bg-white/10';

  const getSegmentButtonClass = (active: boolean, activeClasses: string) =>
    `${controlButtonBaseClass} ${active ? `${activeClasses} shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]` : inactiveControlButtonClass}`;

  const getIconButtonClass = (active: boolean, activeClasses: string) =>
    `h-8 w-8 ${controlButtonBaseClass} ${active ? activeClasses : inactiveControlButtonClass}`;
  const active2DLayerConfig = MAP_LAYER_CONFIG[active2DLayer];
  const available2DLayers = Object.values(MAP_LAYER_CONFIG);

  // NDVI time-series playback
  useEffect(() => {
    if (ndviPlaying && active2DLayer === 'ndvi') {
      ndviTimerRef.current = setInterval(() => {
        setNdviHourIndex((prev) => (prev + 1) % NDVI_HOURS.length);
      }, 1200);
    }
    return () => {
      if (ndviTimerRef.current) clearInterval(ndviTimerRef.current);
    };
  }, [ndviPlaying, active2DLayer]);

  // Resolve current 2D image src: for NDVI use the time-specific image
  const resolved2DLayerSrc = useMemo(() => {
    if (active2DLayer === 'ndvi') return NDVI_HOURS[ndviHourIndex].src;
    return active2DLayerConfig.src;
  }, [active2DLayer, ndviHourIndex, active2DLayerConfig.src]);

  function getDisplayTemperature(tp: { id: number; current_values: Record<string, number> }) {
    return (
      getCurrentValue(tp.id, 'temperature') ??
      getCurrentValue(tp.id, 'air_temperature') ??
      getCurrentValue(tp.id, 'globe_temperature') ??
      getCurrentValue(tp.id, 'surface_temperature') ??
      tp.current_values?.temperature ??
      tp.current_values?.air_temperature ??
      tp.current_values?.globe_temperature ??
      tp.current_values?.surface_temperature ??
      null
    );
  }

  function getDisplayHumidity(tp: { id: number; current_values: Record<string, number> }) {
    return (
      getCurrentValue(tp.id, 'humidity') ??
      tp.current_values?.humidity ??
      null
    );
  }

  return (
    <div className="card-glass h-full flex flex-col overflow-hidden relative">
      {/* Header Info */}
      <div className="absolute top-2 left-2 z-30">
        <motion.div className="bg-black/90 backdrop-blur-xl rounded-xl border border-slate-700/60 p-2 shadow-2xl max-w-[170px]" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-700/50">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <Thermometer className="w-3 h-3 text-cyan-400" />
            <span className="text-cyan-400 text-[9px] font-semibold">{is3DMode ? 'Thermal' : active2DLayerConfig.shortLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
            <div>
              <div className="text-[7px] text-slate-500 uppercase">Temp</div>
              <div className={`text-xs font-bold font-mono ${currentTemp > 40 ? 'text-red-400' : 'text-orange-400'}`} suppressHydrationWarning>{mounted ? currentTemp.toFixed(1) : '--'}°C</div>
            </div>
            <div>
              <div className="text-[7px] text-slate-500 uppercase">Alt</div>
              <div className="text-xs font-bold font-mono text-cyan-400" suppressHydrationWarning>{mounted ? altitude.toFixed(0) : '--'}m</div>
            </div>
            <div className="flex items-center gap-0.5 text-slate-400">
              <MapPin className="w-2 h-2 text-green-500" />
              <span className="font-mono text-[8px]">{coordinates.lat.toFixed(4)}°N</span>
            </div>
            <div className="flex items-center gap-0.5 text-slate-400">
              <Navigation className="w-2 h-2 text-green-500" />
              <span className="font-mono text-[8px]">{coordinates.lng.toFixed(4)}°E</span>
            </div>
            <div className="flex items-center gap-0.5 text-slate-400">
              <Gauge className="w-2 h-2" />
              <span className="text-[8px]" suppressHydrationWarning>{mounted ? speed.toFixed(1) : '-'}m/s</span>
            </div>
            <div className="flex items-center gap-0.5 text-slate-400">
              <Wind className="w-2 h-2" />
              <span className="text-[8px]">{windSpeed}m/s</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Controls */}
      <div className="absolute top-2 right-2 z-30 flex flex-col gap-1.5">
        <div className={glassControlPanelClass}>
          <div className="grid grid-cols-2 gap-1">
            <motion.button
              className={getSegmentButtonClass(!is3DMode, 'border-cyan-400/60 bg-cyan-500/20 text-white')}
              onClick={() => setIs3DMode(false)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Map className="w-3.5 h-3.5" />
              <span>2D</span>
            </motion.button>
            <motion.button
              className={getSegmentButtonClass(is3DMode, 'border-cyan-400/60 bg-cyan-500/20 text-white')}
              onClick={() => setIs3DMode(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Move3d className="w-3.5 h-3.5" />
              <span>3D</span>
            </motion.button>
          </div>

          {is3DMode && (
            <div className="mt-1 grid grid-cols-2 gap-1">
              <motion.button
                className={getSegmentButtonClass(active3DEngine === 'three', 'border-violet-400/60 bg-violet-500/20 text-white')}
                onClick={() => setActive3DEngine('three')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Three</span>
              </motion.button>
              <motion.button
                className={getSegmentButtonClass(active3DEngine === 'cesium', 'border-sky-400/60 bg-sky-500/20 text-white')}
                onClick={() => setActive3DEngine('cesium')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Cesium</span>
              </motion.button>
            </div>
          )}
        </div>

        {!is3DMode && (
          <div className={glassControlPanelClass}>
            <div className="mb-0.5 px-1 text-[8px] font-medium uppercase tracking-[0.18em] text-slate-400">Layer</div>
            <div className="grid grid-cols-3 gap-0.5">
              {available2DLayers.map((layer) => {
                const Icon = layer.icon;
                const isActive = active2DLayer === layer.id;
                const isDisabled = !layer.available;

                return (
                  <motion.button
                    key={layer.id}
                    className={`${getSegmentButtonClass(isActive, layer.accentClasses)} ${isDisabled ? 'cursor-not-allowed opacity-45 hover:bg-slate-950/35' : ''}`}
                    onClick={() => {
                      if (!isDisabled) setActive2DLayer(layer.id);
                    }}
                    whileHover={isDisabled ? undefined : { scale: 1.02 }}
                    whileTap={isDisabled ? undefined : { scale: 0.98 }}
                    title={isDisabled ? `${layer.label} will be available after the NDVI asset is added` : layer.description}
                    disabled={isDisabled}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{layer.shortLabel}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`${glassControlPanelClass} grid grid-cols-4 gap-0.5`}>
          <motion.button className={getIconButtonClass(true, 'border-violet-400/60 bg-violet-500/20 text-violet-100')} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title={`Active Layer: ${active2DLayerConfig.label}`}>
            <Layers className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button className={getIconButtonClass(showFlightPaths, 'border-blue-400/60 bg-blue-500/20 text-blue-100')} onClick={() => setShowFlightPaths(!showFlightPaths)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Flight Paths">
            <Route className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button className={getIconButtonClass(showHeatZones, 'border-red-400/60 bg-red-500/20 text-red-100')} onClick={() => setShowHeatZones(!showHeatZones)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Heat Zones">
            {showHeatZones ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </motion.button>
          <motion.button className={getIconButtonClass(showTestpoints, 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100')} onClick={() => setShowTestpoints(!showTestpoints)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Monitoring Stations">
            <Radio className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        <div className={`${glassControlPanelClass} grid grid-cols-3 gap-0.5`}>
          <motion.button className={getIconButtonClass(planningMode, 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100')} onClick={() => { const newMode = !planningMode; setPlanningMode(newMode); setShowPlanningPanel(newMode); if (!newMode) { setWaypoints([]); setSelectedUAV(null); clearWaypointEntities(); } }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Route Planning">
            <MousePointer className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button className={getIconButtonClass(isFlying, 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100')} onClick={() => setIsFlying(!isFlying)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title={isFlying ? 'Pause Animation' : 'Resume Animation'}>
            {isFlying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </motion.button>
          <motion.button className={getIconButtonClass(false, 'border-slate-400/60 bg-slate-500/20 text-white')} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Fullscreen">
            <Maximize2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {is3DMode && active3DEngine === 'cesium' && cesiumLoaded && (
          <motion.div className={`${glassControlPanelClass} grid grid-cols-3 gap-0.5`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <motion.button className={getIconButtonClass(true, 'border-cyan-400/60 bg-cyan-500/20 text-white')} onClick={() => adjustCameraHeight(-200)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button className={getIconButtonClass(true, 'border-cyan-400/60 bg-cyan-500/20 text-white')} onClick={() => adjustCameraHeight(200)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button className={getIconButtonClass(true, 'border-cyan-400/60 bg-cyan-500/20 text-white')} onClick={resetCamera} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Reset View">
              <RotateCcw className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button className={getIconButtonClass(true, 'border-cyan-400/60 bg-cyan-500/20 text-white')} onClick={() => adjustCameraPitch(10)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Tilt Up">
              <ChevronUp className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button className={getIconButtonClass(true, 'border-cyan-400/60 bg-cyan-500/20 text-white')} onClick={() => adjustCameraPitch(-10)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Tilt Down">
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.button>
            {modelLoaded && (
              <motion.button className={getIconButtonClass(true, 'border-sky-400/60 bg-sky-500/20 text-white')} onClick={focusOnCampusModel} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} title="Focus Campus Model">
                <Building2 className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </motion.div>
        )}
      </div>

      {/* Route Planning Panel */}
      <AnimatePresence>
        {showPlanningPanel && (
          <motion.div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-black/95 backdrop-blur-xl rounded-xl border border-cyan-500/50 p-3 shadow-2xl min-w-[320px]" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-white">Route Planning</span>
              <span className="text-[9px] text-slate-500">({is3DMode ? '3D' : '2D'})</span>
              <button className="ml-auto text-slate-400 hover:text-white" onClick={() => { setShowPlanningPanel(false); setPlanningMode(false); setWaypoints([]); setSelectedUAV(null); clearWaypointEntities(); }}><X className="w-3.5 h-3.5" /></button>
            </div>
            
            {/* UAV Selection */}
            <div className="mb-2">
              <div className="text-[9px] text-slate-400 mb-1.5 uppercase">Select UAV</div>
              <div className="flex gap-1.5">
                {mergedFlightPaths.map(path => (
                  <button key={path.id} className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium border-2 ${selectedUAV === path.id ? '' : 'bg-slate-800 border-slate-700 text-slate-400'}`} style={selectedUAV === path.id ? { backgroundColor: `${path.color}20`, borderColor: path.color, color: path.color } : {}} onClick={() => setSelectedUAV(path.id)}>{path.label}</button>
                ))}
              </div>
            </div>

            {selectedUAV && (
              <>
                {/* Default Altitude Setting */}
                <div className="mb-2 p-2 bg-slate-800/60 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Mountain className="w-3 h-3 text-cyan-400" />
                      <span className="text-[9px] text-slate-400 uppercase">Default Altitude</span>
                    </div>
                    <span className="text-[10px] text-cyan-400 font-mono">{defaultWaypointAltitude}m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="20"
                      max="300"
                      step="10"
                      value={defaultWaypointAltitude}
                      onChange={(e) => setDefaultWaypointAltitude(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-500 mt-1">
                    <span>20m</span>
                    <span>150m</span>
                    <span>300m</span>
                  </div>
                </div>

                {/* Waypoints */}
                <div className="text-[9px] text-slate-400 mb-1 uppercase">Waypoints ({waypoints.length})</div>
                {waypoints.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto space-y-1 mb-2 pr-1">
                    {waypoints.map((wp, i) => (
                      <div key={wp.id} className="flex items-center gap-2 text-[10px] bg-slate-800/80 rounded-lg px-2 py-1.5">
                        <span className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-300 font-mono text-[9px] truncate">
                            {wp.lng ? `${wp.lat?.toFixed(4)}°N, ${wp.lng?.toFixed(4)}°E` : `${wp.x.toFixed(0)}%, ${wp.y.toFixed(0)}%`}
                          </div>
                        </div>
                        {/* Altitude control for each waypoint */}
                        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-1 py-0.5">
                          <button 
                            className="text-cyan-400 hover:text-cyan-300" 
                            onClick={() => updateWaypointAltitude(wp.id, wp.altitude - 10)}
                          >
                            <ArrowDown className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-cyan-400 font-mono text-[9px] w-8 text-center">{wp.altitude}m</span>
                          <button 
                            className="text-cyan-400 hover:text-cyan-300" 
                            onClick={() => updateWaypointAltitude(wp.id, wp.altitude + 10)}
                          >
                            <ArrowUp className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <button className="text-red-400 hover:text-red-300 shrink-0" onClick={() => removeWaypoint(wp.id)}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 text-center py-3 bg-slate-800/50 rounded mb-2">Click {is3DMode ? 'globe' : 'map'} to add waypoints</div>
                )}
                
                <div className="flex gap-1.5">
                  <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1.5 rounded text-[10px]" onClick={() => { setWaypoints([]); clearWaypointEntities(); }}>Clear</button>
                  <button className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 ${waypoints.length > 0 ? 'bg-cyan-500 hover:bg-cyan-400 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`} onClick={applyPlannedRoute} disabled={waypoints.length === 0}><CheckCircle className="w-3 h-3" />Apply</button>
                </div>
              </>
            )}
            
            {!selectedUAV && (
              <div className="text-[10px] text-slate-500 text-center py-3 bg-slate-800/50 rounded">Select UAV to start</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Map */}
      <div className="relative flex-1 overflow-hidden bg-slate-900">
        {/* 2D View */}
        <AnimatePresence>
          {!is3DMode && (
            <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div ref={mapContainerRef} className="absolute inset-0" onClick={handleMapClick} style={{ cursor: planningMode && selectedUAV ? 'crosshair' : 'default' }}>
                {active2DLayer === 'ndvi' ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={resolved2DLayerSrc} alt={`${active2DLayerConfig.label} map`} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                ) : (
                  <Image src={resolved2DLayerSrc} alt={`${active2DLayerConfig.label} map`} fill className="object-cover pointer-events-none" priority />
                )}
                <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
              </div>

              {showHeatZones && heatZones.map((zone) => {
                const style = getRiskStyle(zone.risk);
                return (
                  <div 
                    key={zone.id} 
                    className="absolute cursor-pointer transition-all duration-200" 
                    style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, background: style.bg, border: `2px dashed ${style.border}`, borderRadius: '6px', opacity: hoveredZone === zone.id || selectedZone === zone.id ? 1 : 0.7, transform: hoveredZone === zone.id ? 'scale(1.02)' : 'scale(1)' }} 
                    onMouseEnter={() => !planningMode && setHoveredZone(zone.id)} 
                    onMouseLeave={() => setHoveredZone(null)}
                    onClick={(e) => { if (!planningMode) { e.stopPropagation(); setSelectedZone(selectedZone === zone.id ? null : zone.id); } }}
                  >
                    {/* Quick tooltip on hover */}
                    {hoveredZone === zone.id && !planningMode && selectedZone !== zone.id && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/95 px-2 py-1 rounded text-[9px] whitespace-nowrap border border-slate-600 z-20">
                        <span className="text-white font-medium">{zone.name}</span>
                        <span className="text-slate-400 ml-2">{zone.temp}°C</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Testpoint Markers - 2D View */}
              {showTestpoints && testpoints.filter(tp => Object.keys(tp.statistics || {}).length > 0).map((tp) => {
                const pos = geoToPercent(tp.lng, tp.lat);
                const isSelected = selectedTestpointId === tp.id;
                const isHovered = hoveredTestpoint === tp.id;
                const currentTemp = getDisplayTemperature(tp);
                const currentRH = getDisplayHumidity(tp);
                
                const deviceColors: Record<string, string> = {
                  'HOBO MX': '#3b82f6',
                  'Weather Station': '#22c55e',
                  'Thermocouple': '#f59e0b',
                  'Radiation Tracker': '#a855f7',
                };
                const color = deviceColors[tp.device_type] || '#6b7280';
                
                return (
                  <div
                    key={`testpoint-${tp.id}`}
                    className="absolute z-10 cursor-pointer"
                    style={{ 
                      left: `${pos.x}%`, 
                      top: `${pos.y}%`, 
                      transform: 'translate(-50%, -50%)',
                    }}
                    onMouseEnter={() => setHoveredTestpoint(tp.id)}
                    onMouseLeave={() => setHoveredTestpoint(null)}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setSelectedTestpointId(isSelected ? null : tp.id); 
                    }}
                  >
                    {/* Marker with prominent ID number */}
                    <motion.div
                      className="relative"
                      animate={{ scale: isSelected || isHovered ? 1.15 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Large circular marker */}
                      <div 
                        className={`flex items-center justify-center rounded-full shadow-xl ${
                          isSelected ? 'w-9 h-9' : 'w-7 h-7'
                        }`}
                        style={{ 
                          backgroundColor: color,
                          border: `${isSelected ? '4px' : '3px'} solid white`,
                          boxShadow: `0 0 ${isSelected ? '12px' : '8px'} ${color}80`
                        }}
                      >
                        <span className={`text-white font-bold ${isSelected ? 'text-sm' : 'text-xs'}`}>
                          {tp.id}
                        </span>
                      </div>
                      {/* Pulse animation for selected */}
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ border: `3px solid ${color}` }}
                        />
                      )}
                    </motion.div>
                    
                    {/* Tooltip on hover/select */}
                    {(isHovered || isSelected) && !planningMode && (
                      <motion.div 
                        className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/95 backdrop-blur-sm px-3 py-2 rounded-lg border-2 whitespace-nowrap z-20"
                        style={{ borderColor: color }}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="text-[11px] font-semibold text-white mb-0.5">[{tp.id}] {tp.location_name}</div>
                        <div className="text-[10px] text-slate-400 mb-1.5">{tp.device_type}</div>
                        <div className="flex items-center gap-3">
                          {currentTemp != null && (
                            <div className="flex items-center gap-1">
                              <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                              <span className="text-[11px] font-mono font-bold text-orange-400">{currentTemp.toFixed(1)}°C</span>
                            </div>
                          )}
                          {currentRH != null && (
                            <div className="flex items-center gap-1">
                              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-[11px] font-mono font-bold text-cyan-400">{currentRH.toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}

              {/* Detailed Zone Info Panel */}
              <AnimatePresence>
                {selectedZone && !planningMode && (
                  <motion.div 
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 bg-black/95 backdrop-blur-xl rounded-xl border border-slate-600 p-3 min-w-[280px] shadow-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    {(() => {
                      const zone = heatZones.find(z => z.id === selectedZone);
                      if (!zone) return null;
                      const riskColor = zone.risk === 'high' ? 'text-red-400' : zone.risk === 'medium' ? 'text-yellow-400' : 'text-green-400';
                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${zone.risk === 'high' ? 'bg-red-500' : zone.risk === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                              <span className="text-white font-semibold text-sm">{zone.name}</span>
                            </div>
                            <button className="text-slate-400 hover:text-white" onClick={() => setSelectedZone(null)}>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="bg-slate-800/50 rounded p-2">
                              <div className="text-slate-500 uppercase text-[8px]">Temperature</div>
                              <div className="text-lg font-bold text-orange-400">{zone.temp}°C</div>
                            </div>
                            <div className="bg-slate-800/50 rounded p-2">
                              <div className="text-slate-500 uppercase text-[8px]">Risk Level</div>
                              <div className={`text-lg font-bold capitalize ${riskColor}`}>{zone.risk}</div>
                            </div>
                            <div className="bg-slate-800/50 rounded p-2">
                              <div className="text-slate-500 uppercase text-[8px]">Area</div>
                              <div className="text-sm font-medium text-cyan-400">{(zone.width * zone.height * 2.5).toFixed(0)} m²</div>
                            </div>
                            <div className="bg-slate-800/50 rounded p-2">
                              <div className="text-slate-500 uppercase text-[8px]">Trend</div>
                              <div className="text-sm font-medium text-red-400">+2.1°C/h</div>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-700/50 flex gap-2">
                            <button className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 py-1.5 rounded text-[10px] font-medium">Dispatch UAV</button>
                            <button className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 text-slate-300 py-1.5 rounded text-[10px]">View History</button>
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>

              {showFlightPaths && (
                <>
                  {/* SVG for scalable lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" /></marker>
                      <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#ef4444" /></marker>
                      <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#22c55e" /></marker>
                    </defs>
                    {recordedFlightOverlayPaths.map((path) => {
                      const pathPoints = path.percentPoints.map((point) => `${point.x},${point.y}`).join(' ');
                      return (
                        <g key={`recorded-path-${path.id}`}>
                          <polyline
                            points={pathPoints}
                            fill="none"
                            stroke={path.color}
                            strokeWidth="0.42"
                            strokeDasharray="0.7,0.45"
                            opacity="0.95"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    })}
                    {mergedFlightPaths.map((path) => {
                      const pathPoints = path.points.map(p => `${p.x},${p.y}`).join(' ');
                      const markerEnd = path.type === 'coarse' ? 'url(#arrowBlue)' : path.type === 'fine' ? 'url(#arrowRed)' : 'url(#arrowGreen)';
                      const isAgent = (path as any).isAgentGenerated;
                      return (
                        <g key={`path-${path.id}`}>
                          {path.targetArea && !isAgent && <rect x={path.targetArea.x} y={path.targetArea.y} width={path.targetArea.width} height={path.targetArea.height} fill="none" stroke={path.color} strokeWidth="0.3" strokeDasharray="1,0.5" opacity="0.6" rx="0.5" />}
                          <polyline 
                            points={pathPoints} 
                            fill="none" 
                            stroke={path.color} 
                            strokeWidth={isAgent ? "0.6" : "0.4"} 
                            strokeDasharray={isAgent ? "1.2,0.5" : "1.5,0.8"} 
                            markerEnd={isAgent ? undefined : markerEnd} 
                            opacity="0.9" 
                            strokeLinecap="round"
                          />
                        </g>
                      );
                    })}
                    {waypoints.map((wp, i) => (
                      <g key={`plan-line-${wp.id}`}>
                        {i > 0 && <line x1={waypoints[i-1].x} y1={waypoints[i-1].y} x2={wp.x} y2={wp.y} stroke="#06b6d4" strokeWidth="0.35" strokeDasharray="0.8,0.5" />}
                      </g>
                    ))}
                  </svg>

                  {/* HTML overlay for perfect circles and text */}
                  <div className="absolute inset-0 w-full h-full pointer-events-none z-[8]">
                    {recordedFlightOverlayPaths.map((path) => {
                      const start = path.percentPoints[0];
                      const end = path.percentPoints[path.percentPoints.length - 1];
                      const labelPoint = path.percentPoints[Math.floor(path.percentPoints.length / 2)] ?? start;
                      if (!start || !end || !labelPoint) return null;

                      return (
                        <div key={`recorded-markers-${path.id}`}>
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${start.x}%`, top: `${start.y}%` }}
                          >
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: path.color }} />
                          </div>
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${end.x}%`, top: `${end.y}%` }}
                          >
                            <div className="w-3.5 h-3.5 rotate-45 border-2 border-white shadow-md" style={{ backgroundColor: path.color }} />
                          </div>
                          <div
                            className="absolute z-10 -translate-x-1/2 -translate-y-[140%]"
                            style={{ left: `${labelPoint.x}%`, top: `${labelPoint.y}%` }}
                          >
                            <div className="rounded-full border border-white/20 bg-black/70 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-md">
                              {path.id} • {path.pointCount} pts
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {mergedFlightPaths.map((path) => {
                      const pos = getAnimatedPosition(path);
                      const isAgent = (path as any).isAgentGenerated;
                      return (
                        <div key={`markers-${path.id}`}>
                          {/* Waypoints */}
                          {path.points.map((point, idx) => (
                            <div 
                              key={`wp-${path.id}-${idx}`}
                              className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2"
                              style={{ left: `${point.x}%`, top: `${point.y}%` }}
                            >
                              <div 
                                className="flex items-center justify-center rounded-full border-2 border-white shadow-sm"
                                style={{ 
                                  width: isAgent ? '20px' : '16px', 
                                  height: isAgent ? '20px' : '16px', 
                                  backgroundColor: path.color,
                                  opacity: 0.95
                                }}
                              >
                                <span className="text-white font-bold" style={{ fontSize: isAgent ? '10px' : '9px' }}>{idx + 1}</span>
                              </div>
                            </div>
                          ))}

                          {/* UAV Position Pulse */}
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                          >
                            <div 
                              className="w-5 h-5 rounded-full border-2 border-white shadow-md relative flex items-center justify-center"
                              style={{ backgroundColor: path.color }}
                            >
                              <div 
                                className="absolute inset-0 rounded-full animate-ping"
                                style={{ backgroundColor: path.color, opacity: 0.5 }}
                              />
                            </div>
                          </div>

                          {/* AGENT Badge */}
                          {isAgent && path.points[0] && (
                            <div 
                              className="absolute -translate-x-1/2 -translate-y-[200%] bg-purple-500/90 text-white font-bold rounded shadow-lg border border-purple-400"
                              style={{ left: `${path.points[0].x}%`, top: `${path.points[0].y}%`, padding: '2px 6px', fontSize: '9px' }}
                            >
                              AGENT
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Planning waypoints */}
                    {waypoints.map((wp, i) => (
                      <div
                        key={`plan-wp-${wp.id}`}
                        className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
                      >
                        <div className="w-[18px] h-[18px] rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center shadow-md">
                          <span className="text-white text-[9px] font-bold">{i + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {showFlightPaths && mergedFlightPaths.map((path) => {
                const pos = getAnimatedPosition(path);
                const isAgent = (path as any).isAgentGenerated;
                return (
                  <div key={`label-${path.id}`} className="absolute z-10 pointer-events-none" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -160%)' }}>
                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${isAgent ? 'bg-purple-500/90 border-purple-400 text-white' : ''}`} style={!isAgent ? { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: path.color, color: path.color } : {}}>
                      {isAgent && <Wand2 className="w-3 h-3" />}
                      {path.label}
                      {isAgent && <span className="text-purple-200 text-[8px]">({path.points.length})</span>}
                    </div>
                  </div>
                );
              })}

              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="bg-black/80 px-3 py-1 rounded-full border border-slate-600 text-[10px] text-slate-200">
                  2D {active2DLayerConfig.label}{active2DLayer === 'ndvi' ? ` ${NDVI_HOURS[ndviHourIndex].label}` : ''} • M3M/M3T Tracks{planningMode && selectedUAV && <span className="text-cyan-400 ml-1.5">• Click to add</span>}
                </div>
              </div>

              {/* Compass / North Arrow */}
              <div className="absolute top-16 right-16 z-10 pointer-events-none">
                <div className="w-10 h-10 bg-black/70 rounded-full border border-slate-600 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" className="text-white">
                    <polygon points="12,2 15,10 12,8 9,10" fill="#ef4444" />
                    <polygon points="12,22 9,14 12,16 15,14" fill="#64748b" />
                    <text x="12" y="6" textAnchor="middle" fontSize="5" fill="white" fontWeight="bold">N</text>
                  </svg>
                </div>
              </div>

              {/* Scale Bar */}
              <div className="absolute bottom-16 left-3 z-10 pointer-events-none bg-black/70 rounded px-2 py-1">
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1 bg-white rounded-sm relative">
                    <div className="absolute left-0 top-0 w-1/2 h-full bg-slate-400" />
                  </div>
                  <span className="text-[8px] text-white ml-1">500m</span>
                </div>
              </div>

              {/* Coordinates Grid Overlay */}
              <div className="absolute inset-0 pointer-events-none z-5 opacity-20">
                <svg className="w-full h-full">
                  <defs>
                    <pattern id="grid" width="10%" height="10%" patternUnits="userSpaceOnUse">
                      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#64748b" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              {/* NDVI Time-Series Slider */}
              <AnimatePresence>
                {active2DLayer === 'ndvi' && (
                  <motion.div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-15 pointer-events-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-2 bg-black/85 backdrop-blur-xl rounded-2xl border border-emerald-500/30 px-3 py-2 shadow-2xl">
                      {/* Play / Pause */}
                      <button
                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                          ndviPlaying
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50'
                            : 'bg-slate-700/60 text-slate-300 border border-slate-600 hover:bg-slate-600/60'
                        }`}
                        onClick={() => setNdviPlaying((p) => !p)}
                        title={ndviPlaying ? 'Pause' : 'Play time-lapse'}
                      >
                        {ndviPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>

                      {/* Hour dots */}
                      <div className="flex items-center gap-0.5">
                        {NDVI_HOURS.map((h, i) => (
                          <button
                            key={h.key}
                            className="group relative flex flex-col items-center"
                            onClick={() => { setNdviHourIndex(i); setNdviPlaying(false); }}
                            title={h.label}
                          >
                            <div
                              className={`w-6 h-1.5 rounded-full transition-all duration-200 ${
                                i === ndviHourIndex
                                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                                  : i < ndviHourIndex
                                    ? 'bg-emerald-600/50 group-hover:bg-emerald-500/70'
                                    : 'bg-slate-600/70 group-hover:bg-slate-500/70'
                              }`}
                            />
                            <span className={`text-[7px] mt-0.5 transition-colors ${
                              i === ndviHourIndex ? 'text-emerald-300 font-semibold' : 'text-slate-500 group-hover:text-slate-400'
                            }`}>
                              {h.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Current time badge */}
                      <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2 py-1 ml-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-200 font-mono font-semibold">
                          {NDVI_HOURS[ndviHourIndex].label}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mini Map with current view indicator */}
              <div className="absolute bottom-3 right-3 w-28 h-20 rounded-lg overflow-hidden border border-slate-600 z-10 bg-black/50">
                {active2DLayer === 'ndvi' ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={resolved2DLayerSrc} alt={`${active2DLayerConfig.label} overview`} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                ) : (
                  <Image src={resolved2DLayerSrc} alt={`${active2DLayerConfig.label} overview`} fill className="object-cover opacity-60" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-6 border-2 border-cyan-400 bg-cyan-400/20 rounded-sm" />
                </div>
                <div className="absolute bottom-0.5 left-0.5 text-[7px] text-white bg-black/60 px-1 rounded">{active2DLayerConfig.shortLabel}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D View */}
        {is3DMode && active3DEngine === 'three' && (
          <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
            <ThreeMap
              flightPaths={mergedFlightPaths}
              recordedFlightPaths={RECORDED_FLIGHT_PATHS}
              showFlightPaths={showFlightPaths}
              testpoints={testpoints}
              showTestpoints={showTestpoints}
              selectedTestpointId={selectedTestpointId}
              onSelectTestpoint={(id) => setSelectedTestpointId(selectedTestpointId === id ? null : id)}
              getCurrentValue={getCurrentValue}
              timeOfDay={timeOfDay}
            />
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="bg-black/80 px-3 py-1 rounded-full border border-slate-600 text-[10px] text-slate-200">
                3D Scene • Three.js • Real flight tracks
              </div>
            </div>
          </div>
        )}

        {is3DMode && active3DEngine === 'cesium' && (
          <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
            <div ref={cesiumContainerRef} className="absolute inset-0" />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="bg-black/80 px-3 py-1 rounded-full border border-slate-600 text-[10px] text-slate-200">
                3D Scene • Cesium • Real flight tracks
              </div>
            </div>

            {modelLoading && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="rounded-full border border-cyan-400/40 bg-black/75 px-3 py-1 text-[10px] text-cyan-300 backdrop-blur-xl">
                  Loading Cesium campus model...
                </div>
              </div>
            )}

            {cesiumInitializing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 backdrop-blur-sm">
                <div className="rounded-2xl border border-white/15 bg-black/70 px-5 py-4 text-center shadow-2xl">
                  <div className="text-sm font-semibold text-white">Initializing Cesium</div>
                  <div className="mt-1 text-[11px] text-slate-300">Preparing the 3D campus scene and flight records.</div>
                </div>
              </div>
            )}

            {cesiumError && (
              <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2">
                <div className="flex items-center gap-2 rounded-2xl border border-red-400/40 bg-red-950/70 px-4 py-2 text-[11px] text-red-100 shadow-xl backdrop-blur-xl">
                  <AlertCircle className="w-4 h-4 text-red-300" />
                  <span>{cesiumError}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Layer Legend */}
        <div className="absolute bottom-3 left-3 bg-black/80 rounded-lg border border-slate-700/50 p-2 z-10 pointer-events-none">
          {!is3DMode && active2DLayerConfig.legend === 'ndvi' ? (
            <>
              <div className="text-[8px] text-slate-400 mb-1">NDVI • {NDVI_HOURS[ndviHourIndex].label}</div>
              <div className="w-24 h-2 rounded bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500" />
              <div className="flex justify-between w-24 text-[7px] text-slate-500 mt-0.5"><span>低</span><span>高</span></div>
            </>
          ) : !is3DMode && active2DLayerConfig.legend === 'none' ? (
            <>
              <div className="text-[8px] text-slate-400 mb-1">Base Layer</div>
              <div className="text-[9px] text-slate-200">{active2DLayerConfig.label}</div>
              <div className="text-[7px] text-slate-500 mt-0.5">True-color campus imagery</div>
            </>
          ) : (
            <>
              <div className="text-[8px] text-slate-400 mb-1">Temperature (°C)</div>
              <div className="w-24 h-2 rounded thermal-gradient" />
              <div className="flex justify-between w-24 text-[7px] text-slate-500 mt-0.5"><span>20</span><span>35</span><span>50+</span></div>
            </>
          )}
        </div>
      </div>

      {/* Selected Testpoint Dialog */}
      <AnimatePresence>
        {selectedTestpointId && testpoints.find(tp => tp.id === selectedTestpointId) && (
          <div className="absolute inset-x-0 bottom-0 top-[70px] z-100 pointer-events-none flex items-start justify-center">
            <TestpointDialog
              testpoint={testpoints.find(tp => tp.id === selectedTestpointId)!}
              onClose={() => setSelectedTestpointId(null)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Bar */}
      <div className="p-2 border-t border-[#2a3548] flex items-center justify-between bg-linear-to-r from-[#0a0e1a] to-[#111827]">
        <div className="flex items-center gap-1.5">
          <motion.button className="btn-primary flex items-center gap-1 text-[10px] px-2 py-1.5" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Video className="w-3 h-3" />Live</motion.button>
          <motion.button className="btn-secondary flex items-center gap-1 text-[10px] px-2 py-1.5" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Camera className="w-3 h-3" />Capture</motion.button>
          <motion.button className={`flex items-center gap-1 text-[10px] px-2 py-1.5 rounded ${isRecording ? 'bg-red-500/20 border border-red-500 text-red-400' : 'btn-secondary'}`} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setIsRecording(!isRecording)}><Circle className={`w-3 h-3 ${isRecording ? 'fill-red-500 animate-pulse' : ''}`} />{isRecording ? 'Rec' : 'Record'}</motion.button>
        </div>
        <div className="flex items-center gap-2 text-[9px]">
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded" /><span className="text-slate-400">High</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded" /><span className="text-slate-400">Med</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded" /><span className="text-slate-400">Low</span></div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /><span className="text-blue-400">Coarse</span></div>
          <div className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" /><span className="text-red-400">Fine</span></div>
          <div className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full" /><span className="text-green-400">Standby</span></div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 bg-sky-400 rounded-full" /><span className="text-sky-300">M3M</span></div>
          <div className="flex items-center gap-0.5"><div className="w-1.5 h-1.5 bg-orange-400 rounded-full" /><span className="text-orange-300">M3T</span></div>
        </div>
      </div>
    </div>
  );
}