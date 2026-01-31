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
      console.log('Client connected:', socket.id);

      // Handle data stream from emitter
      socket.on('dataStream', (encryptedStream) => {
        this.processDataStream(encryptedStream);
      });

      // Handle start/stop commands from frontend
      socket.on('startEmitting', () => {
        console.log('Frontend requested to start emitting');
        this.io.emit('startEmitting'); // Forward to emitter
      });

      socket.on('stopEmitting', () => {
        console.log('Frontend requested to stop emitting');
        this.io.emit('stopEmitting'); // Forward to emitter
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
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

      // Emit to frontend
      this.io.emit('newData', {
        ...validatedMessage,
        receivedAt: now,
        stats: this.stats
      });

    } catch (error) {
      console.error('Database save error:', error);
      throw error;
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