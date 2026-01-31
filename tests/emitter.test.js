const crypto = require('crypto');

// Mock the EmitterService for testing
class MockEmitterService {
  constructor() {
    this.data = {
      names: ['John Doe', 'Jane Smith'],
      cities: ['New York', 'Los Angeles', 'Chicago']
    };
    this.encryptionKey = 'test-encryption-key-32-characters!';
  }

  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  generateRandomMessage() {
    const name = this.getRandomElement(this.data.names);
    const origin = this.getRandomElement(this.data.cities);
    const destination = this.getRandomElement(this.data.cities);

    const originalMessage = { name, origin, destination };
    
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
    const algorithm = 'aes-256-ctr';
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }

  decryptMessage(encryptedMessage) {
    const algorithm = 'aes-256-ctr';
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    
    let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  validateMessage(message) {
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
  }
}

describe('EmitterService', () => {
  let emitter;

  beforeEach(() => {
    emitter = new MockEmitterService();
  });

  test('should generate random message with valid structure', () => {
    const message = emitter.generateRandomMessage();
    
    expect(message).toHaveProperty('name');
    expect(message).toHaveProperty('origin');
    expect(message).toHaveProperty('destination');
    expect(message).toHaveProperty('secret_key');
    
    expect(typeof message.name).toBe('string');
    expect(typeof message.origin).toBe('string');
    expect(typeof message.destination).toBe('string');
    expect(typeof message.secret_key).toBe('string');
    expect(message.secret_key).toHaveLength(64); // SHA-256 hex length
  });

  test('should encrypt and decrypt message correctly', () => {
    const originalMessage = emitter.generateRandomMessage();
    const encrypted = emitter.encryptMessage(originalMessage);
    const decrypted = emitter.decryptMessage(encrypted);
    
    expect(decrypted).toEqual(originalMessage);
  });

  test('should validate message integrity correctly', () => {
    const message = emitter.generateRandomMessage();
    expect(emitter.validateMessage(message)).toBe(true);
    
    // Test with tampered message
    const tamperedMessage = { ...message, name: 'Tampered Name' };
    expect(emitter.validateMessage(tamperedMessage)).toBe(false);
  });

  test('should reject message with missing fields', () => {
    const incompleteMessage = {
      name: 'John Doe',
      origin: 'New York'
      // missing destination and secret_key
    };
    
    expect(emitter.validateMessage(incompleteMessage)).toBe(false);
  });

  test('should generate different messages', () => {
    const message1 = emitter.generateRandomMessage();
    const message2 = emitter.generateRandomMessage();
    
    // While it's possible they could be the same due to randomness,
    // it's highly unlikely with the given data set
    expect(message1.secret_key).not.toBe(message2.secret_key);
  });
});