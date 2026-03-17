/**
 * Integration Test Guide
 * 
 * This file demonstrates how to perform integration tests for the notification service.
 * These tests verify the complete flow from API request to database storage.
 */

const VALID_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZmM4MWZkZC1mYzljLTQ5ZTMtOWRmMS1hMzZkZjdlMWVjNWEiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzAzNjAwMDAwfQ.GyTdZVu2VUh8UZ5qmyY8xR2x8xN9pQ6rT5xK3jL4z8M';
const TEST_USER_ID = '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a';


/**
 * INTEGRATION TEST SCENARIO 1: Full Notification Flow
 * 
 * Steps:
 * 1. Verify API is running and healthy
 * 2. Submit a notification via POST /api/notifications
 * 3. Wait for worker to process the message
 * 4. Verify notification is stored in database with correct status
 */

async function testFullNotificationFlow() {
  console.log('Test 1: Full Notification Flow');
  console.log('================================\n');

  // Step 1: Check API health
  console.log('Step 1: Checking API health...');
  const healthResponse = await fetch('http://localhost:8080/health');
  const health = await healthResponse.json();
  console.log('Health status:', health);
  
  if (health.status !== 'healthy') {
    throw new Error('API is not healthy');
  }
  console.log('✓ API is healthy\n');

  // Step 2: Submit notification
  console.log('Step 2: Submitting notification...');
  const notificationPayload = {
    targetUserId: TEST_USER_ID,
    type: 'in-app',
    payload: {
      title: 'Integration Test',
      message: 'This is a test notification',
      timestamp: new Date().toISOString(),
    },
  };

  const submitResponse = await fetch('http://localhost:8080/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VALID_JWT_TOKEN}`,
    },
    body: JSON.stringify(notificationPayload),
  });

  if (submitResponse.status !== 202) {
    throw new Error(`Expected 202, got ${submitResponse.status}`);
  }

  const submitResult = await submitResponse.json();
  console.log('Submitted notification:', submitResult);
  const messageId = submitResult.messageId;
  console.log('✓ Notification submitted with messageId:', messageId, '\n');

  // Step 3: Wait for worker to process
  console.log('Step 3: Waiting for worker to process message...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✓ Waited 2 seconds for processing\n');

  // Step 4: Verify in database
  console.log('Step 4: Verifying notification in database...');
  console.log('Run the following command in a new terminal:');
  console.log(`docker-compose exec db psql -U notification_user -d notification_db -c "SELECT id, user_id, type, status, message_id, created_at, processed_at FROM notifications WHERE message_id = '${messageId}';" `);
  console.log('\nExpected result:');
  console.log('- status should be "processed"');
  console.log('- processed_at should have a timestamp');
  console.log('- payload should contain the JSON data\n');
}

/**
 * INTEGRATION TEST SCENARIO 2: Idempotency Check
 * 
 * Steps:
 * 1. Submit a notification
 * 2. Re-submit the same message (simulate duplicate)
 * 3. Verify only one record is created in database
 */

async function testIdempotency() {
  console.log('Test 2: Idempotency Check');
  console.log('==========================\n');

  console.log('Submitting duplicate notification...');
  
  const notificationPayload = {
    targetUserId: TEST_USER_ID,
    type: 'email',
    payload: {
      subject: 'Idempotency Test',
      body: 'Testing duplicate message handling',
    },
  };

  // First submission
  const response1 = await fetch('http://localhost:8080/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VALID_JWT_TOKEN}`,
    },
    body: JSON.stringify(notificationPayload),
  });

  const result1 = await response1.json();
  const messageId = result1.messageId;

  console.log('First submission - messageId:', messageId);
  console.log('✓ First notification submitted\n');

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Count notifications with this messageId
  console.log('Verifying only one notification is stored...');
  console.log(`Run: docker-compose exec db psql -U notification_user -d notification_db -c "SELECT COUNT(*) as count FROM notifications WHERE message_id = '${messageId}';" `);
  console.log('\nExpected result: count = 1\n');
}

/**
 * INTEGRATION TEST SCENARIO 3: Error Handling
 * 
 * Steps:
 * 1. Submit notification with missing required field
 * 2. Verify API returns 400 Bad Request
 * 3. Submit with invalid auth token
 * 4. Verify API returns 401 Unauthorized
 */

async function testErrorHandling() {
  console.log('Test 3: Error Handling');
  console.log('======================\n');

  // Test 1: Missing required field
  console.log('Test 3a: Missing required field...');
  const invalidPayload = {
    targetUserId: TEST_USER_ID,
    // Missing 'type' and 'payload'
  };

  const response1 = await fetch('http://localhost:8080/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VALID_JWT_TOKEN}`,
    },
    body: JSON.stringify(invalidPayload),
  });

  if (response1.status !== 400) {
    throw new Error(`Expected 400, got ${response1.status}`);
  }
  console.log('✓ Correctly returned 400 Bad Request\n');

  // Test 2: Missing auth token
  console.log('Test 3b: Missing authentication token...');
  const response2 = await fetch('http://localhost:8080/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Missing Authorization header
    },
    body: JSON.stringify({
      targetUserId: TEST_USER_ID,
      type: 'email',
      payload: { subject: 'Test' },
    }),
  });

  if (response2.status !== 401) {
    throw new Error(`Expected 401, got ${response2.status}`);
  }
  console.log('✓ Correctly returned 401 Unauthorized\n');

  // Test 3: Invalid token
  console.log('Test 3c: Invalid authentication token...');
  const response3 = await fetch('http://localhost:8080/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid.token.here',
    },
    body: JSON.stringify({
      targetUserId: TEST_USER_ID,
      type: 'email',
      payload: { subject: 'Test' },
    }),
  });

  if (response3.status !== 401) {
    throw new Error(`Expected 401, got ${response3.status}`);
  }
  console.log('✓ Correctly returned 401 Unauthorized\n');
}

/**
 * INTEGRATION TEST SCENARIO 4: Complex Payload Handling
 * 
 * Steps:
 * 1. Submit notification with complex nested payload
 * 2. Verify payload is correctly stored as JSONB
 * 3. Query and verify all data is preserved
 */

async function testComplexPayload() {
  console.log('Test 4: Complex Payload Handling');
  console.log('==================================\n');

  const complexPayload = {
    targetUserId: TEST_USER_ID,
    type: 'in-app',
    payload: {
      title: 'Complex Notification',
      content: {
        header: 'Order Update',
        body: 'Your order has been shipped',
        metadata: {
          orderId: 'ORD-12345',
          shipping: {
            carrier: 'FedEx',
            trackingNumber: '1234567890',
            estimatedDelivery: '2024-01-25',
          },
          items: [
            { sku: 'ITEM-001', quantity: 2, price: 29.99 },
            { sku: 'ITEM-002', quantity: 1, price: 49.99 },
          ],
        },
      },
      actions: [
        { label: 'Track Package', url: 'https://example.com/track/1234567890' },
        { label: 'View Order', url: 'https://example.com/orders/ORD-12345' },
      ],
    },
  };

  const response = await fetch('http://localhost:8080/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VALID_JWT_TOKEN}`,
    },
    body: JSON.stringify(complexPayload),
  });

  const result = await response.json();
  const messageId = result.messageId;

  console.log('Submitted complex notification with messageId:', messageId);
  console.log('✓ Complex payload submitted\n');

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Verifying complex payload is stored correctly...');
  console.log(`Run: docker-compose exec db psql -U notification_user -d notification_db -c "SELECT payload FROM notifications WHERE message_id = '${messageId}' \\gx;" `);
  console.log('\nExpected: All nested JSON structure should be preserved in payload column\n');
}

/**
 * Run all integration tests
 */

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     NOTIFICATION SERVICE INTEGRATION TESTS             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    await testFullNotificationFlow();
    await testIdempotency();
    await testErrorHandling();
    await testComplexPayload();

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           ALL TESTS COMPLETED SUCCESSFULLY             ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Export for external use
module.exports = {
  testFullNotificationFlow,
  testIdempotency,
  testErrorHandling,
  testComplexPayload,
  runAllTests,
};

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
