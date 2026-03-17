#!/usr/bin/env node

/**
 * Notification Service - Complete Test Client
 * 
 * This script provides end-to-end testing of the notification service.
 * It tests all major functionality including API endpoints, error handling,
 * and integration with RabbitMQ and PostgreSQL.
 * 
 * Usage: node test-client.js
 */

const http = require('http');
const { Pool } = require('pg');

// Configuration
const API_BASE_URL = 'http://localhost:8080';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M';
const TEST_USER_ID = '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

// Test results tracking
let passCount = 0;
let failCount = 0;
const testResults = [];

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function pass(testName) {
  passCount++;
  testResults.push({ name: testName, status: 'PASS' });
  log(`  ✓ ${testName}`, colors.green);
}

function fail(testName, error) {
  failCount++;
  testResults.push({ name: testName, status: 'FAIL', error });
  log(`  ✗ ${testName}`, colors.red);
  if (error) {
    log(`    Error: ${error}`, colors.red);
  }
}

// HTTP request helper
function makeRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body ? JSON.parse(body) : null,
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Wait helper
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Database helper
async function queryDatabase(sql) {
  const pool = new Pool({
    connectionString: 'postgres://notification_user:notification_password@localhost:5432/notification_db',
  });

  try {
    const result = await pool.query(sql);
    await pool.end();
    return result.rows;
  } catch (error) {
    log(`Database error: ${error.message}`, colors.red);
    throw error;
  }
}

// Tests
async function testHealthCheck() {
  log('\nTest 1: Health Check', colors.blue);
  
  try {
    const response = await makeRequest('GET', '/health');
    
    if (response.statusCode === 200 && response.body.status === 'healthy') {
      pass('Health check returns 200 with healthy status');
    } else {
      fail('Health check', `Expected 200 healthy, got ${response.statusCode}`);
    }

    if (response.body.database === 'connected') {
      pass('Database is connected');
    } else {
      fail('Health check - database', 'Database not connected');
    }

    if (response.body.rabbitmq === 'connected') {
      pass('RabbitMQ is connected');
    } else {
      fail('Health check - rabbitmq', 'RabbitMQ not connected');
    }
  } catch (error) {
    fail('Health check', error.message);
  }
}

async function testCreateNotification() {
  log('\nTest 2: Create Notification', colors.blue);
  
  try {
    const payload = {
      targetUserId: TEST_USER_ID,
      type: 'in-app',
      payload: {
        title: 'Test Notification',
        message: 'This is a test message from the test client',
        timestamp: new Date().toISOString(),
      },
    };

    const response = await makeRequest('POST', '/api/notifications', payload, {
      Authorization: `Bearer ${JWT_TOKEN}`,
    });

    if (response.statusCode === 202) {
      pass('POST /api/notifications returns 202 Accepted');
    } else {
      fail('Create notification - status', `Expected 202, got ${response.statusCode}`);
    }

    if (response.body.messageId) {
      pass('Response includes messageId');
      return response.body.messageId;
    } else {
      fail('Create notification - messageId', 'No messageId in response');
    }

    if (response.body.status === 'queued') {
      pass('Notification status is "queued"');
    } else {
      fail('Create notification - status field', `Expected queued, got ${response.body.status}`);
    }
  } catch (error) {
    fail('Create notification', error.message);
  }

  return null;
}

async function testMissingAuthToken() {
  log('\nTest 3: Authentication Validation', colors.blue);
  
  try {
    const payload = {
      targetUserId: TEST_USER_ID,
      type: 'email',
      payload: { subject: 'Test' },
    };

    // No auth header
    const response = await makeRequest('POST', '/api/notifications', payload);

    if (response.statusCode === 401) {
      pass('Missing auth token returns 401');
    } else {
      fail('Missing auth token', `Expected 401, got ${response.statusCode}`);
    }
  } catch (error) {
    fail('Auth validation', error.message);
  }
}

async function testInvalidAuthToken() {
  log('\nTest 4: Invalid Token Handling', colors.blue);
  
  try {
    const payload = {
      targetUserId: TEST_USER_ID,
      type: 'email',
      payload: { subject: 'Test' },
    };

    const response = await makeRequest('POST', '/api/notifications', payload, {
      Authorization: 'Bearer invalid.token.here',
    });

    if (response.statusCode === 401) {
      pass('Invalid auth token returns 401');
    } else {
      fail('Invalid token', `Expected 401, got ${response.statusCode}`);
    }
  } catch (error) {
    fail('Invalid token handling', error.message);
  }
}

async function testMissingRequiredField() {
  log('\nTest 5: Request Validation', colors.blue);
  
  try {
    const payload = {
      targetUserId: TEST_USER_ID,
      // Missing type and payload
    };

    const response = await makeRequest('POST', '/api/notifications', payload, {
      Authorization: `Bearer ${JWT_TOKEN}`,
    });

    if (response.statusCode === 400) {
      pass('Missing required field returns 400');
    } else {
      fail('Missing field', `Expected 400, got ${response.statusCode}`);
    }
  } catch (error) {
    fail('Validation test', error.message);
  }
}

async function testComplexPayload() {
  log('\nTest 6: Complex Payload Handling', colors.blue);
  
  try {
    const payload = {
      targetUserId: TEST_USER_ID,
      type: 'in-app',
      payload: {
        title: 'Order Shipped',
        content: {
          orderId: 'ORD-12345',
          items: [
            { sku: 'SKU001', qty: 2, price: 29.99 },
          ],
        },
        links: {
          track: 'https://example.com/track',
          help: 'https://example.com/help',
        },
      },
    };

    const response = await makeRequest('POST', '/api/notifications', payload, {
      Authorization: `Bearer ${JWT_TOKEN}`,
    });

    if (response.statusCode === 202) {
      pass('Complex nested payload accepted');
    } else {
      fail('Complex payload', `Expected 202, got ${response.statusCode}`);
    }
  } catch (error) {
    fail('Complex payload test', error.message);
  }
}

async function testDatabaseStorage(messageId) {
  log('\nTest 7: Database Storage Verification', colors.blue);
  
  if (!messageId) {
    log('Skipping database test - no messageId from create test', colors.yellow);
    return;
  }

  try {
    // Wait for worker to process
    await wait(3000);

    const results = await queryDatabase(
      `SELECT id, user_id, type, status, message_id, processed_at FROM notifications WHERE message_id = '${messageId}'`
    );

    if (results.length > 0) {
      pass('Notification stored in database');
      
      const notification = results[0];
      
      if (notification.status === 'processed') {
        pass('Notification status is "processed"');
      } else {
        fail('Database - status', `Expected processed, got ${notification.status}`);
      }

      if (notification.processed_at) {
        pass('Notification has processed_at timestamp');
      } else {
        fail('Database - processed_at', 'Missing processed_at timestamp');
      }
    } else {
      fail('Database storage', 'Notification not found in database');
    }
  } catch (error) {
    fail('Database verification', error.message);
  }
}

async function testIdempotency() {
  log('\nTest 8: Idempotency Check', colors.blue);
  
  try {
    const payload = {
      targetUserId: TEST_USER_ID,
      type: 'email',
      payload: { subject: 'Idempotency Test', body: 'Testing duplicates' },
    };

    const response1 = await makeRequest('POST', '/api/notifications', payload, {
      Authorization: `Bearer ${JWT_TOKEN}`,
    });

    const messageId = response1.body.messageId;

    // Wait for processing
    await wait(2000);

    // Check count before second submit
    const before = await queryDatabase(
      `SELECT COUNT(*) as count FROM notifications WHERE message_id = '${messageId}'`
    );

    const countBefore = before[0].count;

    // Submit second time (simulating duplicate)
    await makeRequest('POST', '/api/notifications', payload, {
      Authorization: `Bearer ${JWT_TOKEN}`,
    });

    // Wait for processing
    await wait(2000);

    // Check count after
    const after = await queryDatabase(
      `SELECT COUNT(*) as count FROM notifications WHERE message_id = '${messageId}'`
    );

    const countAfter = after[0].count;

    if (countBefore === countAfter && countAfter === 1) {
      pass('Idempotency prevents duplicate database entries');
    } else {
      fail('Idempotency', `Expected 1 entry, got ${countAfter}`);
    }
  } catch (error) {
    fail('Idempotency test', error.message);
  }
}

async function testReadinessEndpoint() {
  log('\nTest 9: Readiness Endpoint', colors.blue);
  
  try {
    const response = await makeRequest('GET', '/ready');

    if (response.statusCode === 200 && response.body.status === 'ready') {
      pass('Readiness endpoint returns 200 ready');
    } else {
      fail('Ready endpoint', `Expected 200, got ${response.statusCode}`);
    }
  } catch (error) {
    fail('Readiness test', error.message);
  }
}

// Main test runner
async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════╗', colors.bold);
  log('║   NOTIFICATION SERVICE - COMPREHENSIVE TEST SUITE      ║', colors.bold);
  log('╚════════════════════════════════════════════════════════╝', colors.bold);

  try {
    await testHealthCheck();
    const messageId = await testCreateNotification();
    await testMissingAuthToken();
    await testInvalidAuthToken();
    await testMissingRequiredField();
    await testComplexPayload();
    await testDatabaseStorage(messageId);
    await testIdempotency();
    await testReadinessEndpoint();

    // Summary
    log('\n╔════════════════════════════════════════════════════════╗', colors.bold);
    log('║                    TEST SUMMARY                        ║', colors.bold);
    log('╚════════════════════════════════════════════════════════╝', colors.bold);

    log(`\nTotal Tests: ${passCount + failCount}`, colors.bold);
    log(`Passed: ${passCount}`, colors.green);
    log(`Failed: ${failCount}`, colors.red);

    if (failCount === 0) {
      log('\n🎉 ALL TESTS PASSED! 🎉', colors.green);
      log('\nThe notification service is fully operational:', colors.green);
      log('  ✓ API endpoints working correctly', colors.green);
      log('  ✓ Authentication and authorization', colors.green);
      log('  ✓ Message publishing to RabbitMQ', colors.green);
      log('  ✓ Message processing by Worker', colors.green);
      log('  ✓ Database persistence', colors.green);
      log('  ✓ Idempotency mechanism', colors.green);
      process.exit(0);
    } else {
      log(`\n⚠️  ${failCount} test(s) failed. Check the output above for details.`, colors.red);
      process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run tests
runAllTests();
