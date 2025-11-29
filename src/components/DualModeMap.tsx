'use client';

import { FlightPath as AgentFlightPath, useFlightPlan } from '@/context/FlightPlanContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  EyeOff,
  Gauge,
  Globe,
  Layers,
  Map,
  MapPin,
  Maximize2,
  Mountain,
  MousePointer,
  Move3d,
  Navigation,
  Pause,
  Play,
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
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const heatZones: HeatZone[] = [
  { id: 1, x: 40, y: 33, width: 18, height: 18, risk: 'high', temp: 47.3, name: 'Central Plaza' },
  { id: 2, x: 32, y: 55, width: 28, height: 14, risk: 'medium', temp: 39.8, name: 'Parking Area' },
  { id: 3, x: 70, y: 48, width: 20, height: 22, risk: 'low', temp: 35.2, name: 'Research Block' },
];

const percentToGeo = (x: number, y: number) => ({
  lng: 114.2 + (x / 100) * 0.02,
  lat: 22.42 - (y / 100) * 0.015,
});

const geoToPercent = (lng: number, lat: number) => ({
  x: ((lng - 114.2) / 0.02) * 100,
  y: ((22.42 - lat) / 0.015) * 100,
});

export default function DualModeMap() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const clickHandlerRef = useRef<any>(null);
  const flightPathEntitiesRef = useRef<any[]>([]);
  const agentPathEntitiesRef = useRef<any[]>([]);
  
  // Agent flight paths from context
  const { flightPaths: agentFlightPaths } = useFlightPlan();
  
  const [mounted, setMounted] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  const [cesiumError, setCesiumError] = useState<string | null>(null);
  const [cesiumInitializing, setCesiumInitializing] = useState(false);
  
  const [showThermalOverlay, setShowThermalOverlay] = useState(true);
  const [showFlightPaths, setShowFlightPaths] = useState(true);
  const [showHeatZones, setShowHeatZones] = useState(true);
  const [isFlying, setIsFlying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  
  const [currentTemp, setCurrentTemp] = useState(41.1);
  const [coordinates] = useState({ lat: 22.4167, lng: 114.2069 });
  const [altitude, setAltitude] = useState(118.76);
  const [speed, setSpeed] = useState(3.2);
  const [windSpeed] = useState(2.1);
  
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
      destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4167, 1500),
      orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration: 1,
    });
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
    handler.setInputAction((click: any) => {
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
    window.addEventListener('cesium-click', handleCesiumClick as EventListener);
    return () => window.removeEventListener('cesium-click', handleCesiumClick as EventListener);
  }, [planningMode, selectedUAV, addWaypoint]);

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

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(114.2069, 22.4167, cameraHeight),
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

  const addCesiumEntities = (viewer: any, Cesium: any) => {
    heatZones.forEach((zone) => {
      const color = zone.risk === 'high' ? Cesium.Color.RED.withAlpha(0.5) : zone.risk === 'medium' ? Cesium.Color.ORANGE.withAlpha(0.4) : Cesium.Color.YELLOW.withAlpha(0.3);
      const geo = percentToGeo(zone.x + zone.width/2, zone.y + zone.height/2);
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(geo.lng, geo.lat, 50),
        cylinder: { length: 200, topRadius: zone.width * 4, bottomRadius: zone.width * 4, material: color, outline: true, outlineColor: zone.risk === 'high' ? Cesium.Color.RED : zone.risk === 'medium' ? Cesium.Color.ORANGE : Cesium.Color.YELLOW, outlineWidth: 2 },
        label: { text: `${zone.name}\n${zone.temp}°C`, font: '14px sans-serif', fillColor: Cesium.Color.WHITE, style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2, outlineColor: Cesium.Color.BLACK, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -100), showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.8), backgroundPadding: new Cesium.Cartesian2(10, 6) },
      });
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
  }, [mergedFlightPaths]);

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
  }, [agentFlightPaths]);

  useEffect(() => {
    if (is3DMode && mounted && !cesiumLoaded && !cesiumInitializing) {
      initCesium();
    }
  }, [is3DMode, mounted, cesiumLoaded, cesiumInitializing, initCesium]);

  // Destroy Cesium when switching to 2D mode
  useEffect(() => {
    if (!is3DMode && cesiumLoaded) {
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
      setCesiumLoaded(false);
      setCesiumInitializing(false);
    }
  }, [is3DMode, cesiumLoaded]);

  // Update 3D flight paths when flightPaths change or when switching to 3D mode
  useEffect(() => {
    if (is3DMode && cesiumLoaded && viewerRef.current && !viewerRef.current.isDestroyed()) {
      updateCesiumFlightPaths();
    }
  }, [is3DMode, cesiumLoaded, mergedFlightPaths, updateCesiumFlightPaths]);

  // Update 3D Agent flight paths when agentFlightPaths change
  useEffect(() => {
    if (is3DMode && cesiumLoaded && viewerRef.current && !viewerRef.current.isDestroyed()) {
      updateCesiumAgentPaths();
    }
  }, [is3DMode, cesiumLoaded, agentFlightPaths, updateCesiumAgentPaths]);

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

  return (
    <div className="card-glass h-full flex flex-col overflow-hidden relative">
      {/* Header Info */}
      <div className="absolute top-3 left-3 z-20">
        <motion.div className="bg-black/85 backdrop-blur-xl rounded-xl border border-slate-700/60 p-2.5 shadow-2xl" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-700/50">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <Thermometer className="w-3 h-3 text-cyan-400" />
            <span className="text-cyan-400 text-[10px] font-semibold">Thermal Imaging</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div>
              <div className="text-[8px] text-slate-500 uppercase">Temp</div>
              <div className={`text-sm font-bold font-mono ${currentTemp > 40 ? 'text-red-400' : 'text-orange-400'}`} suppressHydrationWarning>{mounted ? currentTemp.toFixed(1) : '--'}°C</div>
            </div>
            <div>
              <div className="text-[8px] text-slate-500 uppercase">Alt</div>
              <div className="text-sm font-bold font-mono text-cyan-400" suppressHydrationWarning>{mounted ? altitude.toFixed(0) : '--'}m</div>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <MapPin className="w-2.5 h-2.5 text-green-500" />
              <span className="font-mono text-[9px]">{coordinates.lat.toFixed(4)}°N</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Navigation className="w-2.5 h-2.5 text-green-500" />
              <span className="font-mono text-[9px]">{coordinates.lng.toFixed(4)}°E</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Gauge className="w-2.5 h-2.5" />
              <span suppressHydrationWarning>{mounted ? speed.toFixed(1) : '-'}m/s</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Wind className="w-2.5 h-2.5" />
              <span>{windSpeed}m/s</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        <div className="bg-black/80 backdrop-blur-xl rounded-lg border border-slate-700/60 p-1 flex flex-col gap-0.5">
          <motion.button className={`p-1.5 rounded transition-all ${is3DMode ? 'bg-cyan-500/30 border border-cyan-500' : 'bg-slate-800/80 border border-slate-700'}`} onClick={() => setIs3DMode(!is3DMode)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {is3DMode ? <Globe className="w-3.5 h-3.5 text-cyan-400" /> : <Map className="w-3.5 h-3.5 text-slate-400" />}
          </motion.button>
          <motion.button className={`p-1.5 rounded transition-all ${showThermalOverlay ? 'bg-orange-500/30 border border-orange-500' : 'bg-slate-800/80 border border-slate-700'}`} onClick={() => setShowThermalOverlay(!showThermalOverlay)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Layers className="w-3.5 h-3.5 text-orange-400" />
          </motion.button>
          <motion.button className={`p-1.5 rounded transition-all ${showFlightPaths ? 'bg-blue-500/30 border border-blue-500' : 'bg-slate-800/80 border border-slate-700'}`} onClick={() => setShowFlightPaths(!showFlightPaths)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Route className="w-3.5 h-3.5 text-blue-400" />
          </motion.button>
          <motion.button className={`p-1.5 rounded transition-all ${showHeatZones ? 'bg-red-500/30 border border-red-500' : 'bg-slate-800/80 border border-slate-700'}`} onClick={() => setShowHeatZones(!showHeatZones)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {showHeatZones ? <Eye className="w-3.5 h-3.5 text-red-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
          </motion.button>
        </div>

        <div className="bg-black/80 backdrop-blur-xl rounded-lg border border-slate-700/60 p-1 flex flex-col gap-0.5">
          <motion.button className={`p-1.5 rounded transition-all ${planningMode ? 'bg-cyan-500/30 border border-cyan-500' : 'bg-slate-800/80 border border-slate-700'}`} onClick={() => { const newMode = !planningMode; setPlanningMode(newMode); setShowPlanningPanel(newMode); if (!newMode) { setWaypoints([]); setSelectedUAV(null); clearWaypointEntities(); } }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
          </motion.button>
          <motion.button className={`p-1.5 rounded transition-all ${isFlying ? 'bg-green-500/30 border border-green-500' : 'bg-slate-800/80 border border-slate-700'}`} onClick={() => setIsFlying(!isFlying)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {isFlying ? <Pause className="w-3.5 h-3.5 text-green-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
          </motion.button>
          <motion.button className="p-1.5 rounded bg-slate-800/80 border border-slate-700" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
          </motion.button>
        </div>

        {/* 3D Camera Controls */}
        {is3DMode && cesiumLoaded && (
          <motion.div className="bg-black/80 backdrop-blur-xl rounded-lg border border-slate-700/60 p-1 flex flex-col gap-0.5" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <motion.button className="p-1.5 rounded bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50" onClick={() => adjustCameraHeight(-200)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
            </motion.button>
            <motion.button className="p-1.5 rounded bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50" onClick={() => adjustCameraHeight(200)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5 text-cyan-400" />
            </motion.button>
            <motion.button className="p-1.5 rounded bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50" onClick={() => adjustCameraPitch(10)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Tilt Up">
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
            </motion.button>
            <motion.button className="p-1.5 rounded bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50" onClick={() => adjustCameraPitch(-10)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Tilt Down">
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
            </motion.button>
            <motion.button className="p-1.5 rounded bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50" onClick={resetCamera} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Reset View">
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            </motion.button>
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
                        <span className="w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">{i + 1}</span>
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
                        <button className="text-red-400 hover:text-red-300 flex-shrink-0" onClick={() => removeWaypoint(wp.id)}><Trash2 className="w-3 h-3" /></button>
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
                <Image src={showThermalOverlay ? "/heatmap.png" : "/rgb.png"} alt="Map" fill className="object-cover pointer-events-none" priority />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
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
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/95 px-2 py-1 rounded text-[9px] whitespace-nowrap border border-slate-600 z-30">
                        <span className="text-white font-medium">{zone.name}</span>
                        <span className="text-slate-400 ml-2">{zone.temp}°C</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Detailed Zone Info Panel */}
              <AnimatePresence>
                {selectedZone && !planningMode && (
                  <motion.div 
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-black/95 backdrop-blur-xl rounded-xl border border-slate-600 p-3 min-w-[280px] shadow-2xl"
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
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" /></marker>
                    <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#ef4444" /></marker>
                    <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#22c55e" /></marker>
                  </defs>
                  {mergedFlightPaths.map((path) => {
                    const pathPoints = path.points.map(p => `${p.x},${p.y}`).join(' ');
                    const markerEnd = path.type === 'coarse' ? 'url(#arrowBlue)' : path.type === 'fine' ? 'url(#arrowRed)' : 'url(#arrowGreen)';
                    const pos = getAnimatedPosition(path);
                    const isAgent = (path as any).isAgentGenerated;
                    return (
                      <g key={path.id}>
                        {path.targetArea && !isAgent && <rect x={path.targetArea.x} y={path.targetArea.y} width={path.targetArea.width} height={path.targetArea.height} fill="none" stroke={path.color} strokeWidth="0.3" strokeDasharray="1,0.5" opacity="0.6" rx="0.5" />}
                        
                        {/* Path line - thicker for agent paths */}
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
                        
                        {/* Waypoint markers with numbers */}
                        {path.points.map((point, idx) => (
                          <g key={`wp-${path.id}-${idx}`}>
                            <circle cx={point.x} cy={point.y} r={isAgent ? "1" : "0.8"} fill={path.color} stroke="white" strokeWidth="0.2" opacity="0.9" />
                            <text x={point.x} y={point.y - 1.5} textAnchor="middle" fill={path.color} fontSize="1.2" fontWeight="bold">{idx + 1}</text>
                          </g>
                        ))}
                        
                        {/* UAV position with pulse effect */}
                        <circle cx={pos.x} cy={pos.y} r="1" fill={path.color} stroke="white" strokeWidth="0.3" />
                        <circle cx={pos.x} cy={pos.y} r="1" fill="none" stroke={path.color} strokeWidth="0.3">
                          <animate attributeName="r" values="1;2.5;1" dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.9;0;0.9" dur="1.5s" repeatCount="indefinite" />
                        </circle>

                        {/* AGENT badge for agent-generated paths */}
                        {isAgent && path.points[0] && (
                          <g>
                            <rect 
                              x={path.points[0].x - 3} 
                              y={path.points[0].y - 4} 
                              width="6" 
                              height="2" 
                              fill="rgba(168,85,247,0.9)" 
                              rx="0.5"
                            />
                            <text 
                              x={path.points[0].x} 
                              y={path.points[0].y - 2.5} 
                              textAnchor="middle" 
                              fill="white" 
                              fontSize="0.8" 
                              fontWeight="bold"
                            >AGENT</text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Planning waypoints */}
                  {waypoints.map((wp, i) => (
                    <g key={wp.id}>
                      {i > 0 && <line x1={waypoints[i-1].x} y1={waypoints[i-1].y} x2={wp.x} y2={wp.y} stroke="#06b6d4" strokeWidth="0.35" strokeDasharray="0.8,0.5" />}
                      <circle cx={wp.x} cy={wp.y} r="1.2" fill="#06b6d4" stroke="white" strokeWidth="0.25" />
                      <text x={wp.x} y={wp.y + 0.4} textAnchor="middle" fill="white" fontSize="1" fontWeight="bold">{i + 1}</text>
                    </g>
                  ))}
                </svg>
              )}

              {showFlightPaths && mergedFlightPaths.map((path) => {
                const pos = getAnimatedPosition(path);
                const isAgent = (path as any).isAgentGenerated;
                return (
                  <div key={`label-${path.id}`} className="absolute z-20 pointer-events-none" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -160%)' }}>
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
                  2D {showThermalOverlay ? 'Thermal' : 'RGB'}{planningMode && selectedUAV && <span className="text-cyan-400 ml-1.5">• Click to add</span>}
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

              {/* Mini Map with current view indicator */}
              <div className="absolute bottom-3 right-3 w-28 h-20 rounded-lg overflow-hidden border border-slate-600 z-10 bg-black/50">
                <Image src="/heatmap.png" alt="Mini" fill className="object-cover opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-6 border-2 border-cyan-400 bg-cyan-400/20 rounded-sm" />
                </div>
                <div className="absolute bottom-0.5 left-0.5 text-[7px] text-white bg-black/60 px-1 rounded">Overview</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D View */}
        <AnimatePresence>
          {is3DMode && (
            <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!cesiumLoaded && !cesiumError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-30">
                  <div className="text-center">
                    <motion.div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-3" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                    <p className="text-slate-300 text-xs">Loading 3D Globe...</p>
                  </div>
                </div>
              )}
              {cesiumError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-30">
                  <div className="text-center">
                    <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                    <p className="text-slate-300 text-xs">{cesiumError}</p>
                    <button className="mt-2 px-3 py-1.5 bg-cyan-500 text-white rounded text-xs" onClick={() => { setCesiumError(null); setCesiumLoaded(false); setCesiumInitializing(false); }}>Retry</button>
                  </div>
                </div>
              )}
              <div ref={cesiumContainerRef} className="absolute inset-0" style={{ cursor: planningMode && selectedUAV ? 'crosshair' : 'default' }} />
              {cesiumLoaded && (
                <>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="bg-black/80 px-3 py-1 rounded-full border border-slate-600 text-[10px] text-slate-200">
                      3D Globe • {cameraHeight.toFixed(0)}m{planningMode && selectedUAV && <span className="text-cyan-400 ml-1.5">• Click to add</span>}
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/80 rounded-lg border border-slate-700/50 p-2 z-10 pointer-events-none">
                    <div className="flex items-center gap-2 text-[9px] text-slate-400">
                      <Move3d className="w-3 h-3 text-cyan-400" />
                      <span>Height: {cameraHeight}m</span>
                      <span>|</span>
                      <span>Pitch: {cameraPitch}°</span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Temperature Scale */}
        <div className="absolute bottom-3 left-3 bg-black/80 rounded-lg border border-slate-700/50 p-2 z-10 pointer-events-none">
          <div className="text-[8px] text-slate-400 mb-1">Temperature (°C)</div>
          <div className="w-24 h-2 rounded thermal-gradient" />
          <div className="flex justify-between w-24 text-[7px] text-slate-500 mt-0.5"><span>20</span><span>35</span><span>50+</span></div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="p-2 border-t border-[#2a3548] flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
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
        </div>
      </div>
    </div>
  );
}