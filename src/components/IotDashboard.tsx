/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Cpu, Radio, AlertTriangle, CheckCircle2,
  Droplets, Wind, Volume2, Thermometer, Activity, Lightbulb,
  Loader2, RefreshCw, Layers, TrendingUp
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { Issue } from '../types';

interface IotDashboardProps {
  issues: Issue[];
  onRefreshIssues: () => Promise<void>;
  theme: 'dark' | 'light';
}

interface MockSensor {
  id: string;
  name: string;
  type: 'flood' | 'air_quality' | 'noise' | 'temperature' | 'pothole_vibration' | 'streetlight_outage';
  value: number;
  unit: string;
  location: string;
  status: 'normal' | 'warning' | 'critical';
  threshold: string;
}

export default function IotDashboard({ issues, onRefreshIssues, theme }: IotDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [activeMetric, setActiveMetric] = useState<'flood' | 'air_quality' | 'noise' | 'temperature' | 'pothole_vibration' | 'streetlight_outage'>('air_quality');
  
  const [sensorReadings, setSensorReadings] = useState<Record<string, number>>({
    'flood': 42.5,
    'air_quality': 88,
    'noise': 58,
    'temperature': 36.2,
    'pothole_vibration': 1.2,
    'streetlight_outage': 350
  });

  // Generate initial historical trend data for Recharts
  const [historicalData, setHistoricalData] = useState<any[]>(() => {
    const data = [];
    const baseTime = Date.now();
    for (let i = 11; i >= 0; i--) {
      const timeStr = new Date(baseTime - i * 15000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      data.push({
        time: timeStr,
        flood: 35 + Math.random() * 15,
        air_quality: 70 + Math.floor(Math.random() * 30),
        noise: 52 + Math.floor(Math.random() * 12),
        temperature: 34 + Math.random() * 3,
        pothole_vibration: 0.5 + Math.random() * 1.5,
        streetlight_outage: 320 + Math.floor(Math.random() * 60)
      });
    }
    return data;
  });

  // Periodically fluctuate readings and update Recharts telemetry stream
  useEffect(() => {
    const interval = setInterval(() => {
      const nextReadings = {
        'flood': Math.max(10, Math.min(95, sensorReadings['flood'] + (Math.random() * 4 - 2))),
        'air_quality': Math.max(30, Math.min(450, sensorReadings['air_quality'] + Math.floor(Math.random() * 10 - 5))),
        'noise': Math.max(40, Math.min(110, sensorReadings['noise'] + Math.floor(Math.random() * 6 - 3))),
        'temperature': Math.max(15, Math.min(50, sensorReadings['temperature'] + (Math.random() * 0.4 - 0.2))),
        'pothole_vibration': Math.max(0.1, Math.min(8.0, sensorReadings['pothole_vibration'] + (Math.random() * 0.6 - 0.3))),
        'streetlight_outage': Math.max(0, Math.min(1000, sensorReadings['streetlight_outage'] + Math.floor(Math.random() * 20 - 10)))
      };

      setSensorReadings(nextReadings);

      setHistoricalData(prev => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newPoint = {
          time: timeStr,
          ...nextReadings
        };
        return [...prev.slice(1), newPoint];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [sensorReadings]);

  // Filter issues created by IoT System or mentioning IoT in their timeline/title/desc
  const iotIssues = useMemo(() => {
    return issues.filter(issue => 
      issue.reportedBy === 'iot_system' || 
      issue.reportedByName?.toLowerCase().includes('iot') ||
      issue.title.toLowerCase().includes('iot') || 
      issue.description.toLowerCase().includes('iot')
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [issues]);

  const activeBreachesCount = iotIssues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length;

  const sensors: MockSensor[] = [
    {
      id: 'SENSOR-CP-FLOOD',
      name: 'Smart Drainage Level Sentry',
      type: 'flood',
      value: sensorReadings['flood'],
      unit: '%',
      location: 'Connaught Place, Sector 4',
      status: sensorReadings['flood'] >= 85 ? 'critical' : sensorReadings['flood'] >= 60 ? 'warning' : 'normal',
      threshold: 'Warning: >60% | Critical: >85%'
    },
    {
      id: 'SENSOR-BW-AQI',
      name: 'Ambient Air Quality Sentry',
      type: 'air_quality',
      value: sensorReadings['air_quality'],
      unit: 'AQI',
      location: 'Bandra West, Link Road',
      status: sensorReadings['air_quality'] >= 200 ? 'critical' : sensorReadings['air_quality'] >= 100 ? 'warning' : 'normal',
      threshold: 'Warning: >100 | Critical: >200'
    },
    {
      id: 'SENSOR-MG-NOISE',
      name: 'Acoustic Decibel Monitor',
      type: 'noise',
      value: sensorReadings['noise'],
      unit: 'dB',
      location: 'MG Road, Brigade Gateway',
      status: sensorReadings['noise'] >= 90 ? 'critical' : sensorReadings['noise'] >= 70 ? 'warning' : 'normal',
      threshold: 'Warning: >70 dB | Critical: >90 dB'
    },
    {
      id: 'SENSOR-PS-TEMP',
      name: 'Thermal Stress Sentinel',
      type: 'temperature',
      value: sensorReadings['temperature'],
      unit: '°C',
      location: 'Park Street, Metro Gate 2',
      status: sensorReadings['temperature'] >= 48 ? 'critical' : sensorReadings['temperature'] >= 42 ? 'warning' : 'normal',
      threshold: 'Warning: >42°C | Critical: >48°C'
    },
    {
      id: 'SENSOR-CP-VIBE',
      name: 'Road Seismograph / Vibration',
      type: 'pothole_vibration',
      value: sensorReadings['pothole_vibration'],
      unit: 'G',
      location: 'Connaught Place, Sector 4',
      status: sensorReadings['pothole_vibration'] >= 6.0 ? 'critical' : sensorReadings['pothole_vibration'] >= 3.5 ? 'warning' : 'normal',
      threshold: 'Warning: >3.5G | Critical: >6.0G'
    },
    {
      id: 'SENSOR-BW-LUX',
      name: 'Photovoltaic Streetlight Monitor',
      type: 'streetlight_outage',
      value: sensorReadings['streetlight_outage'],
      unit: 'lux',
      location: 'Bandra West, Link Road',
      status: sensorReadings['streetlight_outage'] <= 100 ? 'critical' : sensorReadings['streetlight_outage'] <= 250 ? 'warning' : 'normal',
      threshold: 'Warning: <250 lux | Critical: <100 lux'
    }
  ];

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'flood': return <Droplets className="w-5 h-5 text-sky-500" />;
      case 'air_quality': return <Wind className="w-5 h-5 text-teal-400" />;
      case 'noise': return <Volume2 className="w-5 h-5 text-indigo-400" />;
      case 'temperature': return <Thermometer className="w-5 h-5 text-rose-500" />;
      case 'pothole_vibration': return <Activity className="w-5 h-5 text-amber-500" />;
      case 'streetlight_outage': return <Lightbulb className="w-5 h-5 text-yellow-400" />;
      default: return <Cpu className="w-5 h-5 text-indigo-500" />;
    }
  };

  const getStatusBadge = (status: 'normal' | 'warning' | 'critical') => {
    switch (status) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-500 border border-red-500/30 flex items-center gap-1">⚠️ CRITICAL</span>;
      case 'warning':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1">⚡ WARNING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">✓ HEALTHY</span>;
    }
  };

  const triggerSimulation = async (breach: boolean) => {
    setLoading(true);
    setSimulationResult(null);
    try {
      const res = await fetch(`/api/iot/simulate?breach=${breach}`);
      const data = await res.json();
      setSimulationResult(data);
      
      // Update local state with the exact simulation value so it reflects immediately
      if (data.payload) {
        setSensorReadings(prev => ({
          ...prev,
          [data.payload.sensorType]: data.payload.value
        }));
      }

      await onRefreshIssues();
    } catch (err) {
      console.error('Failed to trigger IoT simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recharts Chart Config
  const chartConfigs = {
    flood: { color: '#0ea5e9', label: 'Flood Level (%)', desc: 'Sewer & drain backup monitoring' },
    air_quality: { color: '#2dd4bf', label: 'Air Quality (AQI)', desc: 'Particulate matter & emissions index' },
    noise: { color: '#818cf8', label: 'Noise Pollution (dB)', desc: 'Residential acoustic levels' },
    temperature: { color: '#f43f5e', label: 'Thermal Index (°C)', desc: 'Heat-island effect mitigation tracking' },
    pothole_vibration: { color: '#f59e0b', label: 'Vibration Impact (G-Force)', desc: 'Surface road stress & pothole detection' },
    streetlight_outage: { color: '#facc15', label: 'Luminosity (Lux)', desc: 'Smart street lamp failure reporting' }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER TELEMETRY STRIP ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${theme === 'dark' ? 'bento-card bg-slate-900/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="p-3 bg-indigo-500/10 rounded-xl">
            <Cpu className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <div className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Active IoT Grid Sentry</div>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>6 Live Nodes</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${theme === 'dark' ? 'bento-card bg-slate-900/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="p-3 bg-red-500/10 rounded-xl">
            <Radio className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <div className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Active Breaches Detected</div>
            <div className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {activeBreachesCount} Tickets Out
            </div>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${theme === 'dark' ? 'bento-card bg-slate-900/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <div className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>SLA Auto-Dispatch Rate</div>
            <div className={`text-xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>100% Instant</div>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Active Sensors Grid & Recharts Trend */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SENSORS GRID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className={`text-sm font-bold font-display uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-900'}`}>
                🖧 Live Smart City Sensor Grid Status
              </h2>
              <span className={`text-xs font-mono flex items-center gap-1.5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                <Layers className="w-3.5 h-3.5 animate-pulse" /> Live Telemetry Feeding
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sensors.map(sensor => {
                let pct = 0;
                if (sensor.type === 'flood') pct = sensor.value;
                else if (sensor.type === 'air_quality') pct = (sensor.value / 400) * 100;
                else if (sensor.type === 'noise') pct = (sensor.value / 120) * 100;
                else if (sensor.type === 'temperature') pct = (sensor.value / 55) * 100;
                else if (sensor.type === 'pothole_vibration') pct = (sensor.value / 10) * 100;
                else if (sensor.type === 'streetlight_outage') pct = 100 - (sensor.value / 1000) * 100;
                
                const barColor = sensor.status === 'critical' ? 'bg-red-500' : sensor.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
                const isActive = activeMetric === sensor.type;

                return (
                  <button 
                    key={sensor.id}
                    onClick={() => setActiveMetric(sensor.type)}
                    className={`p-4 rounded-xl border flex flex-col justify-between text-left space-y-4 cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? (theme === 'dark' ? 'bg-indigo-950/40 border-indigo-500 shadow-indigo-500/10' : 'bg-indigo-50/70 border-indigo-500 shadow-sm')
                        : (theme === 'dark' ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm')
                    }`}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}`}>
                          {getSensorIcon(sensor.type)}
                        </div>
                        <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {sensor.id.split('-').pop()}
                        </span>
                      </div>
                      {getStatusBadge(sensor.status)}
                    </div>

                    <div>
                      <div className={`text-xs font-bold line-clamp-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        {sensor.name.replace('Sentry', '').replace('Sentinel', '').replace('Monitor', '')}
                      </div>
                      <div className={`text-[9px] truncate ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {sensor.location}
                      </div>
                    </div>

                    <div className="space-y-1 w-full">
                      <div className="flex items-end justify-between">
                        <span className={`text-[9px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          {sensor.value.toFixed(1)} {sensor.unit}
                        </span>
                      </div>
                      <div className={`h-1 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                          style={{ width: `${Math.max(3, Math.min(100, pct))}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RECHARTS TRENDS CHART */}
          <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bento-card bg-slate-900/40' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-sm font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-800'} flex items-center gap-2`}>
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  Real-time Trend Analysis: {chartConfigs[activeMetric].label}
                </h3>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {chartConfigs[activeMetric].desc} • Updating live every 4s
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20`}>
                RECHARTS GRAPH
              </span>
            </div>

            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`colorGrad-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartConfigs[activeMetric].color} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={chartConfigs[activeMetric].color} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10 }}
                    stroke={theme === 'dark' ? '#334155' : '#cbd5e1'}
                  />
                  <YAxis 
                    tick={{ fill: theme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 10 }}
                    stroke={theme === 'dark' ? '#334155' : '#cbd5e1'}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                      borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
                      borderRadius: '8px',
                      color: theme === 'dark' ? '#ffffff' : '#000000',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey={activeMetric} 
                    name={chartConfigs[activeMetric].label}
                    stroke={chartConfigs[activeMetric].color} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill={`url(#colorGrad-${activeMetric})`} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SIMULATOR TOOLBOX */}
          <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-indigo-950/20 border-indigo-500/20' : 'bg-indigo-50/30 border-indigo-100 shadow-sm'} space-y-4`}>
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-800'}`}>
                ⚙️ IoT Sentry Event Simulator
              </h3>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Simulate a real-time IoT threshold breach to test instant hazard detection and automatic ticketing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => triggerSimulation(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer transition-all"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                Trigger Threshold Breach (Alert)
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => triggerSimulation(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 cursor-pointer transition-all"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Trigger Normal Event (Safe)
              </button>
            </div>

            {simulationResult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg text-xs font-mono space-y-2 border ${
                  theme === 'dark' ? 'bg-black/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="font-bold border-b pb-1.5 flex justify-between">
                  <span>🛰️ Real-time Webhook Event Broadcasted</span>
                  <span className={simulationResult.status === 'alert' ? 'text-red-500 font-bold' : 'text-emerald-500'}>
                    {simulationResult.status.toUpperCase()}
                  </span>
                </div>
                <div><strong>Sensor ID:</strong> {simulationResult.payload?.sensorId}</div>
                <div><strong>Measurement:</strong> {simulationResult.payload?.value} {simulationResult.payload?.unit} ({simulationResult.payload?.sensorType})</div>
                <div><strong>Target Area:</strong> {simulationResult.payload?.location?.address}, {simulationResult.payload?.location?.area}</div>
                {simulationResult.autoIssue && (
                  <div className="mt-2 pt-2 border-t border-dashed border-slate-700 text-indigo-400 font-semibold flex items-center gap-1">
                    🎯 Auto-Created Civic Ticket ID: {simulationResult.autoIssue.id} (Dispatched to {simulationResult.autoIssue.department}!)
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: History / Alerts List */}
        <div className="space-y-4">
          <h2 className={`text-sm font-bold font-display uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-900'}`}>
            🔔 Automated IoT Ticket History
          </h2>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {iotIssues.length === 0 ? (
              <div className={`p-6 rounded-xl text-center border ${
                theme === 'dark' ? 'bg-slate-900/20 border-slate-800/80 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'
              }`}>
                <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No auto-created IoT hazard tickets in system yet. Try running the simulation above!</p>
              </div>
            ) : (
              iotIssues.map(issue => (
                <div 
                  key={issue.id}
                  className={`p-3.5 rounded-xl border space-y-2.5 ${
                    theme === 'dark' 
                      ? 'bg-slate-900/40 border-slate-800/80' 
                      : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                      🛰️ IoT DISPATCH
                    </span>
                    <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {new Date(issue.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold line-clamp-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      {issue.title}
                    </h4>
                    <p className={`text-[11px] mt-0.5 line-clamp-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {issue.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/20 text-[10px]">
                    <span className={`font-semibold uppercase ${
                      issue.status === 'resolved' || issue.status === 'closed' ? 'text-emerald-500' : 'text-amber-500'
                    }`}>
                      ● {issue.status.replace('_', ' ')}
                    </span>
                    <span className={`font-mono font-bold uppercase ${
                      issue.severity === 'high' ? 'text-red-500' : issue.severity === 'medium' ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
