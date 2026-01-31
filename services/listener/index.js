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
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
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

    this.lastEmit = 0;
    this.emitterSocket = null;
    this.isEmitting = false;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    // CORS configuration for production
    const corsOptions = {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true
    };
    
    this.app.use(cors(corsOptions));
    this.app.use(express.json());
  }

  setupRoutes() {
    this.app.get('/health', async (req, res) => {
      try {
        // Check MongoDB connection
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        res.json({ 
          status: 'healthy', 
          database: dbStatus,
          stats: this.stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ 
          status: 'unhealthy', 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/stats', (req, res) => {
      res.json({
        ...this.stats,
        isEmitting: this.isEmitting,
        emitterConnected: this.emitterSocket ? this.emitterSocket.connected : false,
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/debug/start', (req, res) => {
      console.log('Manual START triggered via API');
      this.isEmitting = true;
      
      if (this.emitterSocket && this.emitterSocket.connected) {
        this.emitterSocket.emit('startEmitting');
        res.json({ success: true, message: 'Start command sent to emitter' });
      } else {
        res.json({ success: false, message: 'Emitter not connected' });
      }
    });

    this.app.post('/debug/stop', (req, res) => {
      console.log('Manual STOP triggered via API');
      this.isEmitting = false;
      
      if (this.emitterSocket && this.emitterSocket.connected) {
        this.emitterSocket.emit('stopEmitting');
        res.json({ success: true, message: 'Stop command sent to emitter' });
      } else {
        res.json({ success: false, message: 'Emitter not connected' });
      }
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      const userAgent = socket.handshake.headers['user-agent'];
      const isEmitter = !userAgent || (!userAgent.includes('Mozilla') && !userAgent.includes('frontend-service'));
      const clientType = isEmitter ? 'Emitter' : 'Frontend';
      
      console.log(`${clientType} connected:`, socket.id);
      console.log('User-Agent:', userAgent || 'none');
      console.log('Is Emitter:', isEmitter);
      if (isEmitter) {
        this.emitterSocket = socket;
        console.log('✅ Emitter service connected and ready');
        console.log('🔍 Emitter socket stored:', this.emitterSocket.id);
        
        if (this.isEmitting) {
          console.log('🔄 Resuming emission for reconnected emitter');
          socket.emit('startEmitting');
        }
      }

      // Handle data stream from emitter
      socket.on('dataStream', (encryptedStream) => {
        console.log('Received data stream from emitter');
        this.processDataStream(encryptedStream);
      });

      // Handle start/stop commands from frontend
      socket.on('startEmitting', () => {
        console.log('Frontend requested to START emitting');
        console.log('Current emitter socket:', this.emitterSocket ? this.emitterSocket.id : 'null');
        console.log('Emitter connected:', this.emitterSocket ? this.emitterSocket.connected : false);
        
        this.isEmitting = true;
        
        if (this.emitterSocket && this.emitterSocket.connected) {
          console.log('Sending START command to emitter:', this.emitterSocket.id);
          this.emitterSocket.emit('startEmitting');
          console.log('START command sent successfully');
        } else {
          console.log('Emitter not connected - will start when emitter connects');
        }
      });

      socket.on('stopEmitting', () => {
        console.log('Frontend requested to STOP emitting');
        this.isEmitting = false;
        
        if (this.emitterSocket && this.emitterSocket.connected) {
          console.log('Sending STOP command to emitter:', this.emitterSocket.id);
          this.emitterSocket.emit('stopEmitting');
        }
      });

      socket.on('disconnect', () => {
        console.log(`${clientType} disconnected:`, socket.id);
        
        if (socket === this.emitterSocket) {
          this.emitterSocket = null;
          console.log('Emitter service disconnected');
        }
      });
    });
  }

  decryptMessage(encryptedMessage) {
    try {
      const algorithm = 'aes-256-ctr';
      const parts = encryptedMessage.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted message format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  validateMessage(message) {
    try {
      const { name, origin, destination, secret_key } = message;
      
      if (!name || !origin || !destination || !secret_key) {
        return false;
      }

      const originalMessage = { name, origin, destination };
      const expectedHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(originalMessage))
        .digest('hex');

      return expectedHash === secret_key;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }

  async saveToTimeSeries(validatedMessage) {
    try {
      const now = new Date();
      const minuteKey = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                                now.getHours(), now.getMinutes());

      // Check document size before adding more data
      const existingDoc = await TimeSeriesModel.findOne({ timestamp: minuteKey });
      if (existingDoc && existingDoc.data.length >= 500) {
        console.warn('Minute document at capacity, skipping save to prevent bloat');
        return;
      }

      await TimeSeriesModel.findOneAndUpdate(
        { timestamp: minuteKey },
        {
          $push: {
            data: {
              ...validatedMessage,
              receivedAt: now
            }
          },
          $inc: { count: 1 }
        },
        { upsert: true, new: true }
      );

      // Emit to frontend with rate limiting
      this.emitToFrontend({
        ...validatedMessage,
        receivedAt: now,
        stats: this.stats
      });

    } catch (error) {
      console.error('Database save error:', error);
      throw error;
    }
  }

  emitToFrontend(data) {
    if (!this.lastEmit || Date.now() - this.lastEmit > 1000) {
      this.io.emit('newData', data);
      this.lastEmit = Date.now();
    }
  }

  async processDataStream(encryptedStream) {
    console.log('Processing data stream...');
    
    const encryptedMessages = encryptedStream.split('|');
    this.stats.totalReceived += encryptedMessages.length;

    let processedCount = 0;
    let errorCount = 0;

    for (const encryptedMessage of encryptedMessages) {
      try {
        // Decrypt the message
        const decryptedMessage = this.decryptMessage(encryptedMessage);
        
        // Validate data integrity
        if (this.validateMessage(decryptedMessage)) {
          await this.saveToTimeSeries(decryptedMessage);
          processedCount++;
        } else {
          console.warn('Message validation failed, discarding...');
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing message:', error);
        errorCount++;
      }
    }

    this.stats.totalProcessed += processedCount;
    this.stats.totalErrors += errorCount;
    this.stats.successRate = (this.stats.totalProcessed / this.stats.totalReceived * 100).toFixed(2);

    console.log(`Processed ${processedCount}/${encryptedMessages.length} messages successfully`);
    console.log(`Current success rate: ${this.stats.successRate}%`);
  }

  async connectToDatabase() {
    try {
      await mongoose.connect(this.mongoUri);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async start() {
    await this.connectToDatabase();
    
    this.server.listen(this.port, () => {
      console.log(`Listener service running on port ${this.port}`);
    });
  }
}

// Start the service
const listener = new ListenerService();
listener.start();

process.on('SIGINT', async () => {
  console.log('\nShutting down listener service...');
  await mongoose.connection.close();
  process.exit(0);
});