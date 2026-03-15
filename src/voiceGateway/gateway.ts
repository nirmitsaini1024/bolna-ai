import { Server as HTTPServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { StreamHandler } from './streamHandler';

const logger = createLogger('VoiceGateway');

/**
 * VoiceGateway is the core orchestrator for WebSocket-based real-time voice streaming.
 * 
 * Architecture Principles:
 * 
 * 1. Event-Driven: Uses Node.js non-blocking I/O for high concurrency
 * 2. Connection Pooling: Each call gets a unique WebSocket connection
 * 3. Stateful Sessions: StreamHandler maintains per-call state
 * 4. Scalability: Designed to handle thousands of concurrent calls
 * 
 * Why WebSockets for Voice AI:
 * 
 * - Low Latency: <100ms round-trip required for natural conversations
 * - Full Duplex: Simultaneous send/receive (critical for interruption handling)
 * - Persistent: Single connection per call reduces overhead
 * - Backpressure: WebSocket flow control prevents memory overload
 * 
 * Production Considerations:
 * 
 * - Use sticky sessions / connection affinity in load balancers
 * - Monitor connection pool size and memory usage
 * - Implement connection timeout and heartbeat mechanisms
 * - Add distributed session management (Redis) for multi-instance deployments
 */
export class VoiceGateway {
  private wss: WebSocketServer;
  private streamHandler: StreamHandler;

  constructor(server: HTTPServer, path: string = '/stream') {
    this.streamHandler = new StreamHandler();
    
    this.wss = new WebSocketServer({
      server,
      path,
    });

    this.initialize();
  }

  private initialize(): void {
    logger.info('Voice Gateway initialized', {
      path: this.wss.options.path,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const connectionId = uuidv4();
      
      logger.info('New WebSocket connection', { 
        connectionId,
        activeConnections: this.wss.clients.size,
      });

      this.streamHandler.handleConnection(ws, connectionId);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', error);
    });

    this.startHealthCheck();
  }

  private startHealthCheck(): void {
    setInterval(() => {
      const stats = {
        activeConnections: this.wss.clients.size,
        activeSessions: this.streamHandler.getActiveSessions(),
        uptime: process.uptime(),
      };

      logger.debug('Gateway health check', stats);
    }, 60000);
  }

  getMetrics() {
    return {
      activeConnections: this.wss.clients.size,
      activeSessions: this.streamHandler.getActiveSessions(),
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Voice Gateway');

    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) {
          logger.error('Error during shutdown', err);
          reject(err);
        } else {
          logger.info('Voice Gateway shutdown complete');
          resolve();
        }
      });
    });
  }
}
