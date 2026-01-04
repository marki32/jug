import React, { useEffect, useRef, useState } from 'react';
import { GameMode, ShipType, GameState, ControlState } from '../types';
import { GameEngine } from '../utils/gameEngine';
import { peerService } from '../services/peerService';
import { Gamepad2, Keyboard, Smartphone } from 'lucide-react';

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
  const lastSentControlsRef = useRef<string>(""); 
  
  // Touch Control State
  const touchState = useRef({
    joystick: { active: false, id: -1, startX: 0, startY: 0, currX: 0, currY: 0 },
    buttons: { fire: false, boost: false }
  });
  const [showTouchControls, setShowTouchControls] = useState(false);
  
  // UI State for active inputs
  const [activeInputs, setActiveInputs] = useState<{p1: string, p2: string}>({ p1: 'KEYBOARD', p2: 'WAITING' });
  
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

  // Touch Event Listeners (Mobile Support)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getTouchPos = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      // Handle scaling if CSS size differs from Canvas size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { 
        x: (t.clientX - rect.left) * scaleX, 
        y: (t.clientY - rect.top) * scaleY,
        rawX: t.clientX - rect.left,
        rawY: t.clientY - rect.top
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // Stop scrolling
      setShowTouchControls(true); // Enable UI overlay

      const rect = canvas.getBoundingClientRect();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const { rawX, rawY } = getTouchPos(t);

        // Left Half = Joystick
        if (rawX < rect.width / 2) {
          if (!touchState.current.joystick.active) {
            touchState.current.joystick.active = true;
            touchState.current.joystick.id = t.identifier;
            touchState.current.joystick.startX = rawX;
            touchState.current.joystick.startY = rawY;
            touchState.current.joystick.currX = rawX;
            touchState.current.joystick.currY = rawY;
          }
        } 
        // Right Half = Buttons
        else {
           // Define zones relative to bottom right
           // Fire: Bottom Right corner area
           const fireDist = Math.hypot(rawX - (rect.width - 80), rawY - (rect.height - 80));
           if (fireDist < 70) touchState.current.buttons.fire = true;

           // Boost: To the left of fire
           const boostDist = Math.hypot(rawX - (rect.width - 200), rawY - (rect.height - 60));
           if (boostDist < 60) touchState.current.buttons.boost = true;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchState.current.joystick.id) {
           const { rawX, rawY } = getTouchPos(t);
           touchState.current.joystick.currX = rawX;
           touchState.current.joystick.currY = rawY;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();

      // Check if joystick ended
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchState.current.joystick.id) {
           touchState.current.joystick.active = false;
        }
      }

      // Re-evaluate buttons based on REMAINING touches
      let fire = false;
      let boost = false;
      for (let i = 0; i < e.touches.length; i++) {
         const t = e.touches[i];
         const { rawX, rawY } = getTouchPos(t);
         
         const fireDist = Math.hypot(rawX - (rect.width - 80), rawY - (rect.height - 80));
         if (fireDist < 70) fire = true;

         const boostDist = Math.hypot(rawX - (rect.width - 200), rawY - (rect.height - 60));
         if (boostDist < 60) boost = true;
      }
      touchState.current.buttons.fire = fire;
      touchState.current.buttons.boost = boost;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
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
         if (msg.type === 'INPUT') {
           engineRef.current.setPlayerControls('p2', msg.controls);
         }
      } else if (isClient) {
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

  // --- INPUT HANDLING ---

  const getControls = (
    keys: Set<string>, 
    gamepadIndex: number, 
    keyMapping: { up: string[], down: string[], left: string[], right: string[], shoot: string[], boost: string[] },
    useTouch: boolean
  ): ControlState => {
    
    // 1. Keyboard
    const kUp = keyMapping.up.some(k => keys.has(k));
    const kDown = keyMapping.down.some(k => keys.has(k));
    const kLeft = keyMapping.left.some(k => keys.has(k));
    const kRight = keyMapping.right.some(k => keys.has(k));
    const kShoot = keyMapping.shoot.some(k => keys.has(k));
    const kBoost = keyMapping.boost.some(k => keys.has(k));

    // 2. Touch (Virtual Joystick)
    let tUp = false, tDown = false, tLeft = false, tRight = false, tShoot = false, tBoost = false;
    
    if (useTouch) {
       tShoot = touchState.current.buttons.fire;
       tBoost = touchState.current.buttons.boost;

       if (touchState.current.joystick.active) {
         const dx = touchState.current.joystick.currX - touchState.current.joystick.startX;
         const dy = touchState.current.joystick.currY - touchState.current.joystick.startY;
         
         const threshold = 10;
         if (dy < -threshold) tUp = true;
         if (dy > threshold) tDown = true;
         if (dx < -threshold) tLeft = true;
         if (dx > threshold) tRight = true;
       }
    }

    // 3. Gamepad
    let gpUp = false, gpDown = false, gpLeft = false, gpRight = false, gpShoot = false, gpBoost = false;
    
    if (gamepadIndex !== -2) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let activeGamepad = null;

      if (gamepadIndex === -1) {
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i]) { activeGamepad = gamepads[i]; break; }
        }
      } else if (gamepads[gamepadIndex]) {
        activeGamepad = gamepads[gamepadIndex];
      }

      if (activeGamepad) {
        const axisX = activeGamepad.axes[0];
        const axisY = activeGamepad.axes[1];
        if (axisY < -0.2) gpUp = true;
        if (axisY > 0.2) gpDown = true;
        if (axisX < -0.2) gpLeft = true;
        if (axisX > 0.2) gpRight = true;
        if (activeGamepad.buttons[12]?.pressed) gpUp = true;
        if (activeGamepad.buttons[13]?.pressed) gpDown = true;
        if (activeGamepad.buttons[14]?.pressed) gpLeft = true;
        if (activeGamepad.buttons[15]?.pressed) gpRight = true;
        if (activeGamepad.buttons[0]?.pressed) gpShoot = true; 
        if (activeGamepad.buttons[2]?.pressed) gpShoot = true; 
        if (activeGamepad.buttons[1]?.pressed || activeGamepad.buttons[6]?.pressed || activeGamepad.buttons[7]?.pressed || activeGamepad.buttons[5]?.pressed) gpBoost = true;
      }
    }

    return {
      up: kUp || gpUp || tUp,
      down: kDown || gpDown || tDown,
      left: kLeft || gpLeft || tLeft,
      right: kRight || gpRight || tRight,
      shoot: kShoot || gpShoot || tShoot,
      boost: kBoost || gpBoost || tBoost
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // High DPI Setup
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    
    if (!engineRef.current) {
      engineRef.current = new GameEngine(width, height, mode, p1Ship, p2Ship, (winner) => {
        if (isHost) {
          peerService.send({ type: 'GAME_OVER', winnerId: winner });
          onGameOver(winner);
        } else if (!isClient) {
          onGameOver(winner);
        }
      });
    }

    const render = () => {
      if (!engineRef.current || !ctx) return;

      const keys = keysRef.current;
      
      const p1Keys = { up: ['w'], down: ['s'], left: ['a'], right: ['d'], shoot: [' '], boost: ['shift'] };
      const p2Keys = { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'], shoot: ['m', '.', 'enter'], boost: [',', '/', 'alt'] };
      const clientKeys = { 
        up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'], 
        shoot: [' ', 'm', '.', 'enter'], boost: ['shift', ',', '/', 'ctrl', 'alt'] 
      };

      let p1Controls: ControlState;
      let p2Controls: ControlState | undefined;
      let p1InputType = "KEYBOARD";
      let p2InputType = "WAITING";

      if (isClient) {
        // Client Mode: Enable Touch Controls here
        const myControls = getControls(keys, -1, clientKeys, true);
        const activeGp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(g => g) : null;
        
        const controlsStr = JSON.stringify(myControls);
        if (controlsStr !== lastSentControlsRef.current) {
           peerService.send({ type: 'INPUT', controls: myControls });
           lastSentControlsRef.current = controlsStr;
        }
        
        // Determine input label for HUD
        if (showTouchControls) p1InputType = "TOUCH";
        else if (activeGp) p1InputType = "GAMEPAD";
        else p1InputType = "KEYBOARD";

      } else {
        // HOST Logic
        let p1GpIndex = -2;
        let p2GpIndex = -2;

        if (mode === GameMode.LOCAL_PVP) {
          const allGamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
          const validGamepads = allGamepads.map((g, i) => g ? i : -1).filter(i => i !== -1);
          
          if (validGamepads.length === 1) {
            p1GpIndex = -2; 
            p2GpIndex = validGamepads[0];
            p2InputType = "GAMEPAD";
          } else if (validGamepads.length >= 2) {
             p1GpIndex = validGamepads[0];
             p2GpIndex = validGamepads[1];
             p1InputType = "GAMEPAD";
             p2InputType = "GAMEPAD";
          } else {
             p2InputType = "KEYBOARD (ARROWS)";
          }
        } else {
          // Single / Online Host
          p1GpIndex = -1; 
          const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(g => g) : null;
          if (gp) p1InputType = "GAMEPAD";
        }

        // Host uses touch if they want (e.g. playing on mobile as host)
        p1Controls = getControls(keys, p1GpIndex, p1Keys, true); 
        
        if (mode === GameMode.LOCAL_PVP) {
           p2Controls = getControls(keys, p2GpIndex, p2Keys, false); // P2 Local PvP usually not touch on same screen
        }

        engineRef.current.handleInput(p1Controls, p2Controls);
        engineRef.current.update();

        if (isHost) {
          peerService.send({ type: 'STATE', state: engineRef.current.state });
        }
      }

      // --- RENDER GAME ---
      const state = engineRef.current.state;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
      for (let y = 0; y < height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
      ctx.stroke();

      // Asteroids
      state.asteroids.forEach(a => {
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

      // Players
      state.players.forEach(p => {
        if (p.destroyed) return;
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        
        // Bars
        const hpPct = Math.max(0, p.hp / p.stats.maxHp);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-20, -35, 40, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-20, -35, 40 * hpPct, 4);
        const boostPct = p.boostEnergy / 100;
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-20, -30, 40 * boostPct, 2);

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
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

      // Bullets & Particles
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
      state.particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // --- DRAW MOBILE CONTROLS ---
      if (showTouchControls) {
        const dpr = window.devicePixelRatio || 1; // Unscale for UI drawing if needed, but we scaled context so use logic coords
        
        // Joystick
        if (touchState.current.joystick.active) {
          const { startX, startY, currX, currY } = touchState.current.joystick;
          
          // Base
          ctx.beginPath();
          ctx.arc(startX, startY, 40, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Stick
          ctx.beginPath();
          // Limit stick distance visually
          const dist = Math.hypot(currX - startX, currY - startY);
          const maxDist = 40;
          let drawX = currX;
          let drawY = currY;
          if (dist > maxDist) {
            const angle = Math.atan2(currY - startY, currX - startX);
            drawX = startX + Math.cos(angle) * maxDist;
            drawY = startY + Math.sin(angle) * maxDist;
          }

          ctx.arc(drawX, drawY, 20, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fill();
        } else {
           // Hint text if not active
           ctx.fillStyle = 'rgba(255,255,255,0.2)';
           ctx.font = '12px monospace';
           ctx.fillText("DRAG TO STEER", 50, height - 50);
        }

        // Buttons
        // Fire (Red)
        const fireX = width - 80;
        const fireY = height - 80;
        ctx.beginPath();
        ctx.arc(fireX, fireY, 35, 0, Math.PI * 2);
        ctx.fillStyle = touchState.current.buttons.fire ? 'rgba(239, 68, 68, 0.6)' : 'rgba(239, 68, 68, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText("FIRE", fireX, fireY + 4);

        // Boost (Blue)
        const boostX = width - 200;
        const boostY = height - 60;
        ctx.beginPath();
        ctx.arc(boostX, boostY, 25, 0, Math.PI * 2);
        ctx.fillStyle = touchState.current.buttons.boost ? 'rgba(14, 165, 233, 0.6)' : 'rgba(14, 165, 233, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText("BOOST", boostX, boostY + 3);
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [mode, p1Ship, p2Ship, onGameOver, isHost, isClient, showTouchControls]);

  // Periodic HUD check (removed from render loop to save perf)
  useEffect(() => {
    if (!isOnline && mode === GameMode.LOCAL_PVP) {
      const interval = setInterval(() => {
        const gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g) : [];
        if (gamepads.length === 0) {
           setActiveInputs({ p1: 'KEYBOARD', p2: 'KEYBOARD' });
        } else if (gamepads.length === 1) {
           setActiveInputs({ p1: 'KEYBOARD', p2: 'CONTROLLER' });
        } else {
           setActiveInputs({ p1: 'CONTROLLER 1', p2: 'CONTROLLER 2' });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mode, isOnline]);

  return (
    <div className="w-full h-screen bg-slate-900 relative touch-none select-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none opacity-60">
        <div className="flex items-center gap-2 text-slate-300 font-mono text-xs">
           {showTouchControls ? <Smartphone className="w-4 h-4 text-purple-400"/> : <Keyboard className="w-4 h-4"/>}
           <span>{isClient ? 'YOU' : 'P1'}: {showTouchControls ? 'TOUCH' : 'KEYBOARD'}</span>
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;