# Notification Service - Event-Driven Backend

A robust, scalable notification service built with Node.js, RabbitMQ, and PostgreSQL. This microservices-based solution implements an event-driven architecture with asynchronous message processing, ensuring reliable notification delivery with idempotency and comprehensive error handling.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Setup and Installation](#setup-and-installation)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Error Handling and Idempotency](#error-handling-and-idempotency)
- [Monitoring and Logs](#monitoring-and-logs)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Features

### ✅ Core Requirements Implemented

- **API Service** - RESTful API accessible on port 8080 with configurable port via environment variables
- **Worker Service** - Continuous message queue consumer with durable processing
- **PostgreSQL Database** - Full schema with JSONB support for flexible notification payloads
- **RabbitMQ Message Broker** - Durable queues with proper acknowledgment handling
- **POST /api/notifications Endpoint** - Accepts notifications with targetUserId, type, and flexible payload
- **HTTP 202 Accepted Response** - Proper asynchronous acknowledgment for API requests
- **Message Publishing** - Reliable publishing to RabbitMQ queues
- **Message Consumption** - Worker continuously polls and processes messages
- **JSONB Payload Storage** - Flexible, schema-less notification content storage
- **Database Schema** - Complete with id, user_id, type, payload, status, message_id, retries_attempted, created_at, processed_at
- **Idempotency Mechanism** - Prevents duplicate processing using unique message_id
- **Error Handling & Retries** - Configurable retry mechanism with Dead Letter Queue support
- **JWT Authentication** - Bearer token authentication on protected endpoints
- **Health Check Endpoint** - GET /health verifies all service dependencies
- **Unit Tests** - Comprehensive test coverage for core logic
- **Integration Tests** - Full flow testing with Docker setup
- **Structured Logging** - JSON-formatted logs with service metadata
- **Docker Compose** - Single-command deployment with all services
- **Automatic Database Seeding** - Schema and test data initialization on startup
- **Production-Ready** - Graceful shutdown, health checks, and error recovery

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Service (Port 8080)                      │
│                                                                 │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │   Controllers    │────▶│  Auth Middleware │                 │
│  └──────────────────┘     └──────────────────┘                 │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │   Routes        │                                           │
│  └──────────────────┘                                          │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────┐                      │
│  │  NotificationPublisher (Service)     │                      │
│  │  - Validates request                 │                      │
│  │  - Generates unique message ID       │                      │
│  │  - Publishes to RabbitMQ             │                      │
│  └──────────────────────────────────────┘                      │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────┐
    │      RabbitMQ Message Broker            │
    │                                         │
    │  ┌──────────────────────────────────┐   │
    │  │  notifications_queue (Durable)   │   │
    │  └──────────────────────────────────┘   │
    │  ┌──────────────────────────────────┐   │
    │  │  notifications_dlq (Dead Letter) │   │
    │  └──────────────────────────────────┘   │
    └──────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Worker Service                               │
│                                                                 │
│  ┌──────────────────────────────────────┐                      │
│  │  NotificationConsumer                │                      │
│  │  - Consumes messages                 │                      │
│  │  - Tracks retry attempts             │                      │
│  │  - Handles failures gracefully       │                      │
│  └──────────────────────────────────────┘                      │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────┐                      │
│  │  NotificationProcessor               │                      │
│  │  - Idempotency checking              │                      │
│  │  - Database persistence              │                      │
│  │  - Transaction management            │                      │
│  │  - Error handling                    │                      │
│  └──────────────────────────────────────┘                      │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────┐
        │  PostgreSQL Database            │
        │                                 │
        │  ┌──────────────────────────┐   │
        │  │  users table             │   │
        │  │  notifications table     │   │
        │  │  (JSONB payload support) │   │
        │  └──────────────────────────┘   │
        └─────────────────────────────────┘
```

## Technologies Used

### Backend
- **Node.js 18** - JavaScript runtime
- **Express.js 4.18** - Web framework
- **PostgreSQL 15** - Relational database
- **RabbitMQ 3.12** - Message broker
- **amqplib 0.10** - AMQP client library
- **pg 8.10** - PostgreSQL client
- **jsonwebtoken 9.1** - JWT authentication
- **Winston 3.11** - Structured logging

### Testing & Development
- **Jest 29.7** - Testing framework
- **Supertest 6.3** - HTTP assertion library
- **Nodemon 3.0** - Development auto-reload

### Infrastructure
- **Docker & Docker Compose** - Containerization and orchestration
- **Alpine Linux** - Lightweight base image

## Prerequisites

- Docker and Docker Compose (version 3.8 or higher)
- Node.js 18+ (for local development without Docker)
- npm or yarn package manager
- 2GB RAM minimum
- Port availability: 8080, 5432, 5672, 15672

## Setup and Installation

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   cd notification-service
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Build and start services**
   ```bash
   docker-compose up --build
   ```

   This command will:
   - Build API and Worker Docker images
   - Start PostgreSQL database
   - Start RabbitMQ broker
   - Start API service on port 8080
   - Start Worker service
   - Automatically seed the database with schema and test data

4. **Verify services are running**
   ```bash
   curl http://localhost:8080/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "rabbitmq": "connected",
     "timestamp": "2024-01-21T12:00:00.000Z"
   }
   ```

### Option 2: Local Development Setup

1. **Install dependencies**
   ```bash
   cd api && npm install && cd ..
   cd worker && npm install && cd ..
   ```

2. **Start PostgreSQL and RabbitMQ**
   ```bash
   docker-compose up -d db rabbitmq
   ```

3. **Create and seed database**
   ```bash
   psql -h localhost -U notification_user -d notification_db -f db/init.sql
   ```

4. **Create .env file**
   ```bash
   cp .env.example .env
   ```

5. **Start API and Worker services**
   ```bash
   # Terminal 1
   cd api && npm start

   # Terminal 2
   cd worker && npm start
   ```

## Running the Application

### Start Services
```bash
docker-compose up
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f db
```

### Access Services
- **API**: http://localhost:8080
- **RabbitMQ Management UI**: http://localhost:15672 (guest:guest)
- **PostgreSQL**: localhost:5432

## API Documentation

### Authentication

All API endpoints require JWT Bearer token authentication. Test token is available for development:

```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M
```

### Endpoints

#### 1. Create Notification (POST /api/notifications)

**Purpose**: Submit a notification for asynchronous processing

**Authentication**: Required (Bearer JWT)

**Request**:
```bash
curl -X POST http://localhost:8080/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M" \
  -d '{
    "targetUserId": "9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a",
    "type": "in-app",
    "payload": {
      "title": "Your order has shipped!",
      "message": "Track your package now.",
      "orderId": "ORD12345",
      "link": "https://example.com/track/ORD12345"
    }
  }'
```

**Request Body**:
```json
{
  "targetUserId": "string (UUID)",
  "type": "string (e.g., 'email', 'in-app', 'sms')",
  "payload": "object (flexible structure)"
}
```

**Success Response** (202 Accepted):
```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Notification accepted for processing"
}
```

**Error Responses**:

- 400 Bad Request (Missing fields):
```json
{
  "error": "Bad Request",
  "message": "Missing required fields: targetUserId, type, payload"
}
```

- 400 Bad Request (Invalid payload):
```json
{
  "error": "Bad Request",
  "message": "Payload must be a JSON object"
}
```

- 401 Unauthorized (Missing/Invalid token):
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization token"
}
```

- 500 Internal Server Error:
```json
{
  "error": "Internal Server Error",
  "message": "Failed to process notification"
}
```

#### 2. Health Check (GET /health)

**Purpose**: Verify service health and dependencies

**Authentication**: Not required

**Request**:
```bash
curl http://localhost:8080/health
```

**Success Response** (200 OK):
```json
{
  "status": "healthy",
  "database": "connected",
  "rabbitmq": "connected",
  "timestamp": "2024-01-21T12:00:00.000Z"
}
```

**Unhealthy Response** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "rabbitmq": "connected",
  "timestamp": "2024-01-21T12:00:00.000Z"
}
```

#### 3. Ready Check (GET /ready)

**Purpose**: Check if API is fully initialized

**Authentication**: Not required

**Request**:
```bash
curl http://localhost:8080/ready
```

**Response** (200 OK):
```json
{
  "status": "ready"
}
```

### Example Workflows

**Example 1: Email Notification**
```bash
curl -X POST http://localhost:8080/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M" \
  -d '{
    "targetUserId": "9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a",
    "type": "email",
    "payload": {
      "to": "user@example.com",
      "subject": "Welcome to our service",
      "body": "Thank you for signing up!",
      "htmlContent": "<h1>Welcome</h1><p>Thank you!</p>"
    }
  }'
```

**Example 2: SMS Notification**
```bash
curl -X POST http://localhost:8080/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M" \
  -d '{
    "targetUserId": "9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a",
    "type": "sms",
    "payload": {
      "phoneNumber": "+1234567890",
      "message": "Your verification code is: 123456"
    }
  }'
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns**:
- `id`: Unique identifier (UUID)
- `username`: User's username (unique)
- `password_hash`: Bcrypt hashed password
- `email`: User's email address (unique)
- `created_at`: Account creation timestamp

### Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    message_id VARCHAR(255) UNIQUE,
    retries_attempted INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message VARCHAR(500)
);
```

**Columns**:
- `id`: Unique notification identifier (UUID)
- `user_id`: Reference to target user (Foreign Key)
- `type`: Notification type (email, in-app, sms, etc.)
- `payload`: JSONB - Flexible notification content
- `status`: Processing status (pending, processed, failed)
- `message_id`: Unique message identifier for idempotency
- `retries_attempted`: Number of processing attempts
- `created_at`: Notification creation timestamp
- `processed_at`: Timestamp when successfully processed
- `error_message`: Error details if processing failed

### Indexes
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_message_id ON notifications(message_id);
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

**Purpose**: Optimize query performance for common filtering operations

### Sample Data
```sql
INSERT INTO users (id, username, email) VALUES
('9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a', 'testuser', 'test@example.com'),
('550e8400-e29b-41d4-a716-446655440001', 'user1', 'user1@example.com'),
('550e8400-e29b-41d4-a716-446655440002', 'user2', 'user2@example.com');
```

## Testing

### Run Unit Tests

**API Tests**:
```bash
docker-compose exec api npm test
```

**Worker Tests**:
```bash
docker-compose exec worker npm test
```

**All Tests**:
```bash
docker-compose exec api npm test && docker-compose exec worker npm test
```

### Test Coverage

#### API Service Tests
- **NotificationPublisher**: Message publishing and UUID generation
- **NotificationController**: Request validation, error handling, response codes
- **AuthMiddleware**: JWT verification and token validation

#### Worker Service Tests
- **NotificationProcessor**: Database insertion, idempotency, transaction handling
- **NotificationConsumer**: Message consumption, retry logic, DLQ handling

### Manual Integration Testing

**1. Create a notification**:
```bash
curl -X POST http://localhost:8080/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M" \
  -d '{
    "targetUserId": "9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a",
    "type": "in-app",
    "payload": {"title": "Test", "message": "Test message"}
  }'
```

**2. Verify in database**:
```bash
docker-compose exec db psql -U notification_user -d notification_db \
  -c "SELECT id, user_id, type, status, created_at, processed_at FROM notifications ORDER BY created_at DESC LIMIT 5;"
```

**3. Check RabbitMQ Queue**:
- Access http://localhost:15672
- Login with guest:guest
- Navigate to Queues tab
- Check `notifications_queue`

**4. View logs**:
```bash
docker-compose logs -f api
docker-compose logs -f worker
```

## Error Handling and Idempotency

### Idempotency Implementation

**Problem**: Duplicate message processing can occur due to:
- Network retries
- Consumer acknowledgment failures
- Service restarts

**Solution**: 
- Each notification message includes a unique `messageId`
- Before processing, the Worker checks if `messageId` exists in database
- If duplicate found, the message is acknowledged without re-processing
- This ensures exactly-once processing semantics

**Code Flow**:
```
Message Received
    ↓
Check if message_id exists in DB
    ↓
If YES: Return success (already processed)
If NO: Process and insert into DB
    ↓
Acknowledge message to RabbitMQ
```

### Retry Mechanism

**Retry Policy**:
- Maximum retries: 3 (configurable via `MAX_RETRIES` env var)
- Requeue strategy: Negative acknowledgment (nack) with requeue flag
- DLQ routing: After max retries, message moves to Dead Letter Queue

**Failure Handling Process**:
```
Message Processing
    ↓
Success? → YES → Acknowledge to RabbitMQ
    ↓ NO
Is retry < MAX_RETRIES?
    ↓ YES
Nack with requeue=true (message goes back to queue)
Record retry attempt in database
    ↓ NO
Send to Dead Letter Queue
Mark notification as 'failed' in database
Record error message and retry count
```

### Database Transactionality

- All database operations use explicit transactions (BEGIN/COMMIT/ROLLBACK)
- Ensures consistency between message acknowledgment and database state
- If database insert fails, transaction is rolled back and message is nacked

### Error Recovery

**On API Error**:
- Returns appropriate HTTP status codes
- Logs structured error information
- Graceful degradation if RabbitMQ is temporarily unavailable

**On Worker Error**:
- Automatic retry with exponential tracking
- Failed notifications recorded in database
- Error messages preserved for debugging
- Service continues processing other messages

## Monitoring and Logs

### Structured Logging Format

All logs are output in JSON format with the following structure:
```json
{
  "timestamp": "2024-01-21T12:00:00.000Z",
  "level": "info",
  "message": "Notification published successfully",
  "service": "api",
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a",
  "type": "in-app"
}
```

### Log Levels

- **ERROR**: System failures (e.g., database connection lost)
- **WARN**: Degraded conditions (e.g., max retries exceeded)
- **INFO**: Normal operations (e.g., message processed)
- **DEBUG**: Detailed debug information (enabled with LOG_LEVEL=debug)

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service with timestamp
docker-compose logs -f --timestamps api

# Last 100 lines
docker-compose logs --tail=100 api

# Filter by keyword
docker-compose logs | grep "error"
```

### Key Metrics to Monitor

- **API Response Time**: Check logs for endpoint execution time
- **Message Processing Rate**: Monitor worker logs for processed message count
- **Error Rate**: Track WARN and ERROR log entries
- **Queue Depth**: Check RabbitMQ management UI for pending messages
- **Database Performance**: Query database for oldest unprocessed notifications

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# API Configuration
API_PORT=8080
NODE_ENV=production
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgres://notification_user:notification_password@db:5432/notification_db

# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_in_production

# Worker Configuration
QUEUE_NAME=notifications_queue
DLQ_NAME=notifications_dlq
MAX_RETRIES=3
```

### Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | 8080 | Port for API service |
| `NODE_ENV` | development | Environment (development/production) |
| `LOG_LEVEL` | info | Logging level (error/warn/info/debug) |
| `DATABASE_URL` | postgres://... | PostgreSQL connection string |
| `RABBITMQ_URL` | amqp://... | RabbitMQ connection URL |
| `JWT_SECRET` | (required) | Secret key for JWT signing/verification |
| `QUEUE_NAME` | notifications_queue | Main message queue name |
| `DLQ_NAME` | notifications_dlq | Dead Letter Queue name |
| `MAX_RETRIES` | 3 | Maximum retry attempts for failed messages |

## Troubleshooting

### Services Won't Start

**Issue**: "port 8080 already in use"
```bash
# Find and kill process using port 8080
lsof -ti:8080 | xargs kill -9
```

**Issue**: "Cannot connect to Docker daemon"
```bash
# Ensure Docker is running
docker ps
```

### Database Connection Issues

**Issue**: "Failed to connect to database"
```bash
# Check if database service is healthy
docker-compose ps db

# View database logs
docker-compose logs db

# Try reconnecting after waiting
docker-compose restart db
```

**Issue**: "Relation does not exist"
```bash
# Database schema not initialized
# Verify init.sql was executed
docker-compose exec db psql -U notification_user -d notification_db -c "\dt"

# Manually run init script if needed
docker-compose exec db psql -U notification_user -d notification_db -f /docker-entrypoint-initdb.d/init.sql
```

### RabbitMQ Issues

**Issue**: "Cannot connect to RabbitMQ"
```bash
# Check if RabbitMQ is running
docker-compose ps rabbitmq

# View RabbitMQ logs
docker-compose logs rabbitmq

# Check connection from API/Worker
curl telnet://localhost:5672
```

**Issue**: "Queues not created"
- Services automatically create queues on startup
- Check RabbitMQ management UI: http://localhost:15672

### Worker Not Processing Messages

**Issue**: Messages stuck in queue
```bash
# Check if worker is running
docker-compose ps worker

# View worker logs for errors
docker-compose logs -f worker

# Check queue status in RabbitMQ UI
```

**Issue**: Repeated failures
```bash
# Check error_message column in database
docker-compose exec db psql -U notification_user -d notification_db \
  -c "SELECT id, status, error_message, retries_attempted FROM notifications WHERE status='failed';"
```

### Authentication Issues

**Issue**: "Invalid token" error
```bash
# Ensure correct JWT token is used
# Verify JWT_SECRET matches in .env file

# Generate new token for testing (example)
# Token payload: {"userId": "9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a", "username": "testuser"}
```

### Performance Issues

**Issue**: Slow message processing
```bash
# Check database indexes
docker-compose exec db psql -U notification_user -d notification_db -c "\di"

# Monitor resource usage
docker stats

# Check slow queries
docker-compose logs worker | grep "Database"
```


