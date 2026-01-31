const io = require('socket.io-client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class EmitterService {
  constructor() {
    this.socket = null;
    this.data = this.loadData();
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    this.emitInterval = parseInt(process.env.EMIT_INTERVAL) || 10000;
    this.minMessages = parseInt(process.env.MIN_MESSAGES) || 49;
    this.maxMessages = parseInt(process.env.MAX_MESSAGES) || 499;
    this.listenerUrl = process.env.LISTENER_URL || 'http://localhost:3001';
  }

  loadData() {
    try {
      const dataPath = path.join(__dirname, '../../data.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading data.json:', error);
      process.exit(1);
    }
  }

  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  generateRandomMessage() {
    const name = this.getRandomElement(this.data.names);
    const origin = this.getRandomElement(this.data.cities);
    const destination = this.getRandomElement(this.data.cities);

    const originalMessage = { name, origin, destination };
    
    // Create SHA-256 hash of the original message
    const secretKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(originalMessage))
      .digest('hex');

    return {
      ...originalMessage,
      secret_key: secretKey
    };
  }

  encryptMessage(message) {
    try {
      const algorithm = 'aes-256-ctr';
      const iv = crypto.randomBytes(16);
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  generateDataStream() {
    const messageCount = Math.floor(
      Math.random() * (this.maxMessages - this.minMessages + 1)
    ) + this.minMessages;

    const encryptedMessages = [];
    
    for (let i = 0; i < messageCount; i++) {
      const message = this.generateRandomMessage();
      const encryptedMessage = this.encryptMessage(message);
      encryptedMessages.push(encryptedMessage);
    }

    return encryptedMessages.join('|');
  }

  connect() {
    console.log(`Connecting to listener at ${this.listenerUrl}...`);
    
    this.socket = io(this.listenerUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Connected to listener service');
      this.startEmitting();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from listener service');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });
  }

  startEmitting() {
    console.log(`Starting to emit data every ${this.emitInterval}ms`);
    
    setInterval(() => {
      try {
        const dataStream = this.generateDataStream();
        console.log(`Emitting data stream with ${dataStream.split('|').length} messages`);
        
        this.socket.emit('dataStream', dataStream);
      } catch (error) {
        console.error('Error generating/emitting data stream:', error);
      }
    }, this.emitInterval);
  }

  start() {
    console.log('Starting Emitter Service...');
    this.connect();
  }
}

// Start the service
const emitter = new EmitterService();
emitter.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down emitter service...');
  if (emitter.socket) {
    emitter.socket.disconnect();
  }
  process.exit(0);
});