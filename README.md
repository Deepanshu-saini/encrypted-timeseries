# Encrypted Time-Series Data Streaming Application

A real-time encrypted data streaming application built with Node.js, featuring three microservices that work together to generate, process, and visualize encrypted time-series data.

## 🏗️ Architecture

The application consists of three main services:

1. **Emitter Service** - Generates and encrypts random data streams
2. **Listener Service** - Decrypts, validates, and stores data in MongoDB
3. **Frontend Service** - Real-time dashboard for data visualization

## 🚀 Features

- **Real-time Data Streaming**: Socket.io-based communication between services
- **AES-256-CTR Encryption**: Secure data transmission with integrity validation
- **Time-Series Database**: Optimized MongoDB schema for time-series data
- **Live Dashboard**: Real-time visualization with success rate monitoring
- **Docker Support**: Complete containerization with docker-compose
- **Error Handling**: Comprehensive error handling and logging
- **Testing**: Unit tests with Jest
- **Scalable Architecture**: Microservices-based design

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 7+
- Docker & Docker Compose (optional)

## 🛠️ Installation & Setup

### Option 1: Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd encrypted-timeseries
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:7
   
   # Or use your local MongoDB installation
   ```

4. **Start the services** (in separate terminals)
   ```bash
   # Terminal 1: Start Listener Service
   npm run dev:listener
   
   # Terminal 2: Start Frontend Service  
   npm run dev:frontend
   
   # Terminal 3: Start Emitter Service
   npm run dev:emitter
   ```

5. **Access the application**
   - Frontend Dashboard: http://localhost:3000
   - Listener API: http://localhost:3001

### Option 2: Docker Deployment

1. **Build and start all services**
   ```bash
   docker-compose up --build
   ```

2. **Access the application**
   - Frontend Dashboard: http://localhost:3000
   - All services will be automatically connected

## 🔧 Configuration

Environment variables are configured in `.env`:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/timeseries
MONGODB_DATABASE=timeseries

# Service Ports
LISTENER_PORT=3001
FRONTEND_PORT=3000

# Service URLs
LISTENER_URL=http://localhost:3001

# Encryption Configuration
ENCRYPTION_KEY=my-secret-encryption-key-32-chars!

# Emitter Configuration
EMIT_INTERVAL=10000
MIN_MESSAGES=49
MAX_MESSAGES=499
```

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 📊 Data Flow

1. **Emitter Service**:
   - Generates random messages from `data.json`
   - Creates SHA-256 hash for data integrity
   - Encrypts messages using AES-256-CTR
   - Sends pipe-separated encrypted stream every 10 seconds

2. **Listener Service**:
   - Receives encrypted data streams via Socket.io
   - Decrypts and validates message integrity
   - Stores valid data in MongoDB time-series collections
   - Forwards processed data to frontend

3. **Frontend Service**:
   - Displays real-time data stream
   - Shows transmission success rates
   - Provides live statistics dashboard

## 🗄️ Database Schema

The MongoDB schema is optimized for time-series queries:

```javascript
{
  timestamp: Date,        // Minute-level timestamp for grouping
  count: Number,         // Number of records in this minute
  data: [{               // Array of records for this minute
    name: String,
    origin: String,
    destination: String,
    secret_key: String,
    receivedAt: Date
  }]
}
```

## 🔒 Security Features

- **AES-256-CTR Encryption**: Industry-standard encryption algorithm
- **SHA-256 Integrity Validation**: Ensures data hasn't been tampered with
- **Input Validation**: Comprehensive validation of all incoming data
- **Error Isolation**: Failed messages don't affect the entire stream

## 📈 Performance Optimizations

- **Time-Series Grouping**: Data grouped by minute for efficient queries
- **Database Indexing**: Optimized indexes for time-series operations
- **Connection Pooling**: Efficient database connection management
- **Memory Management**: Limited frontend display items for performance

## 🐳 Docker Services

The application includes Docker configurations for:

- **MongoDB**: Database service with persistent storage
- **Listener**: API and socket server
- **Emitter**: Data generation service  
- **Frontend**: Web dashboard

## 🔍 Monitoring & Debugging

- **Health Endpoints**: `/health` endpoints for service monitoring
- **Statistics API**: `/stats` endpoint for real-time metrics
- **Comprehensive Logging**: Detailed logs for debugging
- **Error Tracking**: Proper error handling and reporting

## health endpoints:

- Listener Health: http://localhost:3001/health
- Listener Stats: http://localhost:3001/stats
- Frontend Health: http://localhost:3000/health

