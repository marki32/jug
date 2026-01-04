import React, { useState } from 'react';
import { ScreenState, GameMode, ShipType } from './types';
import Lobby from './components/Lobby';
import GameCanvas from './components/GameCanvas';
import { peerService } from './services/peerService';

const App: React.FC = () => {
  const [screen, setScreen] = useState<ScreenState>(ScreenState.LOBBY);
  const [gameConfig, setGameConfig] = useState<{ mode: GameMode; p1: ShipType; p2: ShipType }>({
    mode: GameMode.LOCAL_PVP,
    p1: ShipType.FIGHTER,
    p2: ShipType.INTERCEPTOR
  });
  const [winner, setWinner] = useState<string | null>(null);

  const startGame = (mode: GameMode, p1: ShipType, p2: ShipType) => {
    setGameConfig({ mode, p1, p2 });
    setScreen(ScreenState.GAME);
  };

  const handleGameOver = (winnerId: string) => {
    setWinner(winnerId);
    setScreen(ScreenState.GAME_OVER);
    // Cleanup network if game ends naturally
    // peerService.destroy(); // Optional: Keep connection for rematch? simpler to just destroy and re-lobby.
  };

  const returnToLobby = () => {
     peerService.destroy();
     setScreen(ScreenState.LOBBY);
  };

  return (
    <div className="w-full h-full">
      {screen === ScreenState.LOBBY && (
        <Lobby onStart={startGame} />
      )}

      {screen === ScreenState.GAME && (
        <GameCanvas 
          mode={gameConfig.mode} 
          p1Ship={gameConfig.p1} 
          p2Ship={gameConfig.p2} 
          onGameOver={handleGameOver} 
        />
      )}

      {screen === ScreenState.GAME_OVER && (
        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white z-50 animate-in fade-in duration-500">
           <div className="text-6xl font-black mb-4 tracking-tighter italic">
            {winner === 'DISCONNECTED' ? 'SIGNAL LOST' : (winner === 'DRAW' ? 'DRAW!' : (winner === 'p1' ? 'PLAYER 1 WINS' : (winner === 'p2' ? 'PLAYER 2 WINS' : 'ENEMY WINS')))}
           </div>
           <div className="text-2xl text-slate-400 mb-8 font-mono">
             {winner === 'DISCONNECTED' ? 'Connection Terminated' : (winner === 'p1' ? 'Mission Accomplished' : 'Mission Failed')}
           </div>
           
           <button 
            onClick={returnToLobby}
            className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(8,145,178,0.5)]"
           >
             RETURN TO BASE
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
