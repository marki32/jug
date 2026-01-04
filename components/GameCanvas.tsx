import React, { useEffect, useRef } from 'react';
import { GameMode, ShipType, GameState, ControlState } from '../types';
import { GameEngine } from '../utils/gameEngine';
import { peerService } from '../services/peerService';

interface GameCanvasProps {
  mode: GameMode;
  p1Ship: ShipType;
  p2Ship: ShipType;
  onGameOver: (winner: string) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ mode, p1Ship, p2Ship, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  
  // Track if we are the host or client
  const isHost = mode === GameMode.ONLINE_HOST;
  const isClient = mode === GameMode.ONLINE_CLIENT;
  const isOnline = isHost || isClient;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Network Handlers
  useEffect(() => {
    if (!isOnline) return;

    peerService.onClose = () => {
       onGameOver('DISCONNECTED');
    };

    peerService.onData = (msg) => {
      if (!engineRef.current) return;

      if (isHost) {
         // Host receiving data from Client
         if (msg.type === 'INPUT') {
           engineRef.current.setPlayerControls('p2', msg.controls);
         } else if (msg.type === 'HANDSHAKE') {
           console.log("Client handshake received:", msg.shipType);
         }
      } else if (isClient) {
         // Client receiving data from Host
         if (msg.type === 'STATE') {
           engineRef.current.setState(msg.state);
         } else if (msg.type === 'GAME_OVER') {
           onGameOver(msg.winnerId);
         }
      }
    };

    return () => {
      peerService.onData = null;
      peerService.onClose = null;
    };
  }, [isOnline, isHost, isClient, onGameOver]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle High DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    // Init Engine
    const width = rect.width;
    const height = rect.height;
    
    engineRef.current = new GameEngine(width, height, mode, p1Ship, p2Ship, (winner) => {
      if (isHost) {
        // Host notifies client
        peerService.send({ type: 'GAME_OVER', winnerId: winner });
        onGameOver(winner);
      } else if (!isClient) {
        onGameOver(winner);
      }
    });

    const render = () => {
      if (!engineRef.current || !ctx) return;

      // Logic Step
      if (isClient) {
        // Client Logic: Collect Inputs -> Send to Host
        const clientControls: ControlState = {
           // Map WASD to P2 controls
           up: keysRef.current.has('w'),
           left: keysRef.current.has('a'),
           down: keysRef.current.has('s'),
           right: keysRef.current.has('d'),
           boost: keysRef.current.has('shift'),
           shoot: keysRef.current.has(' '),
        };
        peerService.send({ type: 'INPUT', controls: clientControls });
      } else {
        // Host / Local Logic
        // 1. Process Local Inputs
        engineRef.current.handleInput(keysRef.current, mode);
        
        // 2. Run Physics
        engineRef.current.update();

        // 3. If Host, broadcast state
        if (isHost) {
          peerService.send({ type: 'STATE', state: engineRef.current.state });
        }
      }

      const state = engineRef.current.state;

      // --- RENDERING --- (Common for all modes)
      
      // Clear
      ctx.fillStyle = '#0f172a'; // Slate-900
      ctx.fillRect(0, 0, width, height);

      // Draw Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
      for (let y = 0; y < height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
      ctx.stroke();

      // Draw Asteroids
      ctx.shadowBlur = 0;
      state.asteroids.forEach(a => {
        if (a.destroyed) return;
        ctx.save();
        ctx.translate(a.pos.x, a.pos.y);
        ctx.rotate(a.angle);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const r = a.radius;
        ctx.moveTo(r, 0);
        for (let i = 1; i < 8; i++) {
          const angle = (i * Math.PI * 2) / 8;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.restore();
      });

      // Draw Players
      state.players.forEach(p => {
        if (p.destroyed) return;
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        
        // Health Bar
        const hpPct = p.hp / p.stats.maxHp;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-20, -35, 40, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-20, -35, 40 * hpPct, 4);

        // Boost Bar
        const boostPct = p.boostEnergy / 100;
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-20, -30, 40 * boostPct, 2);

        // Name
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        // Display logic for names
        let name = p.id;
        if (p.id === 'p1') name = isClient ? 'OPPONENT' : 'YOU';
        if (p.id === 'p2') name = isClient ? 'YOU' : (isHost ? 'OPPONENT' : 'P2');
        ctx.fillText(name, 0, -40);

        ctx.rotate(p.angle);

        ctx.shadowBlur = 10;
        ctx.shadowColor = p.stats.color;
        ctx.strokeStyle = p.stats.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.fill();

        if (p.controls.up) {
          ctx.beginPath();
          ctx.moveTo(-8, 0);
          ctx.lineTo(-18 - Math.random() * 5, 0);
          ctx.strokeStyle = p.controls.boost ? '#06b6d4' : '#f97316';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.restore();
      });

      // Draw Bullets
      state.bullets.forEach(b => {
        ctx.save();
        ctx.translate(b.pos.x, b.pos.y);
        ctx.rotate(b.angle);
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#fff';
        ctx.fillStyle = '#fff';
        ctx.fillRect(-5, -1, 10, 2);
        ctx.restore();
      });

      // Draw Particles
      state.particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mode, p1Ship, p2Ship, onGameOver, isHost, isClient]);

  return (
    <div className="w-full h-screen bg-slate-900 relative">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block"
      />
      
      {/* HUD Overlay */}
      <div className="absolute bottom-4 left-4 text-slate-500 font-mono text-xs pointer-events-none opacity-50">
        CONTROLS: WASD / SPACE / SHIFT
      </div>
      {isOnline && (
        <div className="absolute top-4 right-4 flex items-center gap-2 text-green-400 font-mono text-xs opacity-70">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           CONNECTED: {isHost ? 'HOST' : 'CLIENT'}
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
