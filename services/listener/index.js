const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const TimeSeriesModel = require('./models/TimeSeries');

class ListenerService {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.port = process.env.LISTENER_PORT || 3001;
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/timeseries';
    
    this.stats = {
      totalReceived: 0,
      totalProcessed: 0,
      totalErrors: 0,
      successRate: 0
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', stats: this.stats });
    });

    this.app.get('/stats', (req, res) => {
      res.json(this.stats);
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Emitter connected:', socket.id);

      socket.on('dataStream', (encryptedStream) => {
        this.processDataStream(encryptedStream);
      });

      socket.on('disconnect', () => {
        console.log('Emitter disconnected:', socket.id);
      });
    });
  }


  async start() {
    
    this.server.listen(this.port, () => {
      console.log(`Listener service running on port ${this.port}`);
    });
  }
}

// Start the service
const listener = new ListenerService();
listener.start();