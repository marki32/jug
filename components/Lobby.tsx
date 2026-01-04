import React, { useState } from 'react';
import { ShipType, GameMode, ShipStats } from '../types';
import { SHIP_STATS } from '../constants';
import { Rocket, Shield, Zap, Target, Users, Globe, Loader2, Copy, Info } from 'lucide-react';
import { peerService } from '../services/peerService';

interface LobbyProps {
  onStart: (mode: GameMode, p1Ship: ShipType, p2Ship: ShipType) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [selectedShip, setSelectedShip] = useState<ShipType>(ShipType.FIGHTER);
  const [mode, setMode] = useState<GameMode>(GameMode.LOCAL_PVP);
  
  // Online States
  const [peerId, setPeerId] = useState<string>("");
  const [joinId, setJoinId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");

  const stats = SHIP_STATS[selectedShip];

  const startHosting = async () => {
    setIsConnecting(true);
    setConnectionStatus("Initializing Comm Link...");
    try {
      const id = await peerService.initialize();
      setPeerId(id);
      setConnectionStatus("Waiting for Opponent...");
      
      peerService.onConnect = () => {
        // Connected!
        onStart(GameMode.ONLINE_HOST, selectedShip, ShipType.FIGHTER); 
      };
    } catch (e) {
      setConnectionStatus("Connection Failed");
      setIsConnecting(false);
    }
  };

  const joinGame = async () => {
    if (!joinId) return;
    setIsConnecting(true);
    setConnectionStatus("Searching for signal...");
    try {
      await peerService.initialize(); // Get our own ID first
      peerService.connect(joinId);
      
      peerService.onConnect = () => {
        // Connected!
        // Client sends handshake with their ship type
        peerService.send({ type: 'HANDSHAKE', shipType: selectedShip });
        onStart(GameMode.ONLINE_CLIENT, ShipType.FIGHTER, selectedShip);
      };
    } catch (e) {
      setConnectionStatus("Connection Failed");
      setIsConnecting(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(peerId);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-4 font-mono relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 w-full max-w-5xl bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-8">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
          STARFIGHTER ARENA
        </h1>
        <p className="text-center text-slate-400 mb-8 uppercase tracking-widest text-sm">
          Multiplayer Dogfight Simulator
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Ship Selection */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
              <Rocket className="w-5 h-5" /> Select Class
            </h2>
            <div className="flex flex-col gap-3">
              {(Object.keys(SHIP_STATS) as ShipType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedShip(type)}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${
                    selectedShip === type
                      ? 'border-cyan-500 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                  }`}
                >
                  <div className="text-left">
                    <div className={`font-bold text-lg ${selectedShip === type ? 'text-cyan-400' : 'text-slate-300'}`}>
                      {SHIP_STATS[type].name}
                    </div>
                  </div>
                  {selectedShip === type && <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />}
                </button>
              ))}
            </div>

            {/* Mode Selection */}
            <div className="mt-8">
               <h2 className="text-xl font-bold flex items-center gap-2 text-purple-400 mb-4">
                <Target className="w-5 h-5" /> Combat Mode
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setMode(GameMode.LOCAL_PVP); setPeerId(""); setIsConnecting(false); }}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                    mode === GameMode.LOCAL_PVP
                      ? 'border-pink-500 bg-pink-900/20 text-pink-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <Users className="w-6 h-6" />
                  <span className="text-sm font-bold">Local</span>
                </button>
                <button
                  onClick={() => { setMode(GameMode.ONLINE_HOST); setPeerId(""); setIsConnecting(false); }}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                    mode === GameMode.ONLINE_HOST || mode === GameMode.ONLINE_CLIENT
                      ? 'border-green-500 bg-green-900/20 text-green-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <Globe className="w-6 h-6" />
                  <span className="text-sm font-bold">Online PvP</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Stats or Connection UI */}
          <div className="flex flex-col">
            {mode === GameMode.ONLINE_HOST || mode === GameMode.ONLINE_CLIENT ? (
              <div className="bg-slate-900/80 rounded-xl p-6 border border-slate-700 flex-1 flex flex-col justify-center items-center space-y-6">
                <h3 className="text-xl font-bold text-green-400">Online Setup</h3>
                
                {!isConnecting ? (
                  <div className="w-full space-y-4">
                    <button 
                      onClick={startHosting}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all"
                    >
                      HOST GAME
                    </button>
                    <div className="flex items-center gap-2">
                       <div className="h-px bg-slate-700 flex-1"></div>
                       <span className="text-slate-500 text-sm">OR</span>
                       <div className="h-px bg-slate-700 flex-1"></div>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Enter Host ID" 
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 text-white focus:outline-none focus:border-green-500"
                      />
                      <button 
                        onClick={joinGame}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 rounded-lg transition-all"
                      >
                        JOIN
                      </button>
                    </div>
                  </div>
                ) : (
                   <div className="text-center w-full">
                     <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
                     <p className="text-slate-300 font-bold mb-2">{connectionStatus}</p>
                     
                     {peerId && (
                       <div className="bg-slate-950 p-4 rounded-lg border border-slate-700 flex items-center justify-between gap-4 mt-4">
                         <code className="text-green-400 text-sm break-all">{peerId}</code>
                         <button onClick={copyId} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                           <Copy className="w-4 h-4" />
                         </button>
                       </div>
                     )}

                     <button 
                       onClick={() => { setIsConnecting(false); peerService.destroy(); }}
                       className="mt-8 text-sm text-red-400 hover:text-red-300 underline"
                     >
                       Cancel
                     </button>
                   </div>
                )}
              </div>
            ) : (
              // Normal Stats View
              <div className="flex flex-col h-full">
                <h2 className="text-xl font-bold flex items-center gap-2 text-green-400 mb-6">
                  <Info className="w-5 h-5" /> Specs
                </h2>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 flex-1 relative">
                  <div className="space-y-4">
                    <StatBar label="Speed" value={stats.maxSpeed} max={8} icon={<Zap className="w-4 h-4 text-yellow-400"/>} />
                    <StatBar label="Armor" value={stats.maxHp} max={200} icon={<Shield className="w-4 h-4 text-blue-400"/>} />
                    <StatBar label="Firepower" value={stats.damage * (1000/stats.fireRate)} max={200} icon={<Target className="w-4 h-4 text-red-400"/>} />
                  </div>
                </div>

                <button
                  onClick={() => onStart(mode, selectedShip, ShipType.FIGHTER)}
                  className="mt-6 w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xl rounded-xl shadow-lg shadow-cyan-900/20 transform hover:scale-[1.02] transition-all active:scale-[0.98]"
                >
                  LAUNCH MISSION
                </button>
              </div>
            )}
          </div>
        </div>
        
        {mode === GameMode.LOCAL_PVP && (
           <div className="mt-4 text-center text-xs text-slate-500">
             <span className="mr-4"><strong className="text-slate-300">P1:</strong> WASD + Space</span>
             <span><strong className="text-slate-300">P2:</strong> Arrows + M / (.)</span>
           </div>
        )}
      </div>
    </div>
  );
};

const StatBar = ({ label, value, max, icon }: { label: string, value: number, max: number, icon: React.ReactNode }) => (
  <div>
    <div className="flex justify-between text-xs mb-1 text-slate-400 uppercase font-bold">
      <span className="flex items-center gap-1">{icon} {label}</span>
      <span>{Math.round((value/max)*100)}%</span>
    </div>
    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" 
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  </div>
);

export default Lobby;
