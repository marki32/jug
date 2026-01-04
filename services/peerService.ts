import Peer, { DataConnection } from 'peerjs';
import { NetworkMessage } from '../types';

export class PeerService {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  
  // Callbacks
  onData: ((data: NetworkMessage) => void) | null = null;
  onConnect: (() => void) | null = null;
  onClose: (() => void) | null = null;

  async initialize(): Promise<string> {
    if (this.peer) {
        this.destroy();
    }

    return new Promise((resolve, reject) => {
      // Create a new Peer. 
      // We rely on the default peerjs cloud server.
      this.peer = new Peer({
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      // Handle signaling server disconnection
      this.peer.on('disconnected', () => {
          console.log('Peer disconnected from signaling server. Reconnecting...');
          if (this.peer && !this.peer.destroyed) {
              this.peer.reconnect();
          }
      });

      this.peer.on('error', (err) => {
        console.error('Peer error', err);
        // Attempt to reject the promise if it's still pending
        reject(err);
      });
    });
  }

  connect(peerId: string) {
    if (!this.peer || this.peer.destroyed) return;
    try {
        const conn = this.peer.connect(peerId);
        this.handleConnection(conn);
    } catch (err) {
        console.error("Connect failed", err);
    }
  }

  handleConnection(conn: DataConnection) {
    if (this.conn) {
        this.conn.close();
    }
    this.conn = conn;

    this.conn.on('open', () => {
      console.log('Connected to: ' + this.conn?.peer);
      if (this.onConnect) this.onConnect();
    });

    this.conn.on('data', (data) => {
      if (this.onData) this.onData(data as NetworkMessage);
    });

    this.conn.on('close', () => {
      console.log('Connection closed');
      this.conn = null;
      if (this.onClose) this.onClose();
    });

    this.conn.on('error', (err) => {
      console.error('Connection error', err);
      this.conn = null;
      if (this.onClose) this.onClose();
    });
  }

  send(data: NetworkMessage) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  destroy() {
    if (this.conn) {
        this.conn.close();
        this.conn = null;
    }
    if (this.peer) {
        this.peer.destroy();
        this.peer = null;
    }
    // Clear callbacks to prevent memory leaks or stale state calls
    this.onData = null;
    this.onConnect = null;
    this.onClose = null;
  }
}

export const peerService = new PeerService();