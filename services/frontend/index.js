const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

class FrontendService {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.port = process.env.FRONTEND_PORT || 3000;
    this.listenerUrl = process.env.LISTENER_URL || 'http://localhost:3001';
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.connectToListener();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Frontend client connected:', socket.id);

      socket.on('startEmitting', () => {
        console.log('Frontend HTML requested START - forwarding to listener');
        this.listenerSocket.emit('startEmitting');
      });

      socket.on('stopEmitting', () => {
        console.log('Frontend HTML requested STOP - forwarding to listener');
        this.listenerSocket.emit('stopEmitting');
      });

      socket.on('disconnect', () => {
        console.log('Frontend client disconnected:', socket.id);
      });
    });
  }

  connectToListener() {
    const io = require('socket.io-client');
    this.listenerSocket = io(this.listenerUrl, {
      extraHeaders: {
        'user-agent': 'frontend-service-proxy'
      }
    });

    this.listenerSocket.on('connect', () => {
      console.log('Connected to listener service');
    });

    this.listenerSocket.on('newData', (data) => {
      this.io.emit('newData', data);
    });

    this.listenerSocket.on('disconnect', () => {
      console.log('Disconnected from listener service');
    });

    this.listenerSocket.on('connect_error', (error) => {
      console.error('Error connecting to listener:', error.message);
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Frontend service running on port ${this.port}`);
      console.log(`Open http://localhost:${this.port} in your browser`);
    });
  }
}

// Start the service
const frontend = new FrontendService();
frontend.start();

process.on('SIGINT', () => {
  console.log('\nShutting down frontend service...');
  process.exit(0);
});