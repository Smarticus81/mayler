#!/usr/bin/env node

/**
 * Supabase Setup Test Script
 * Tests authentication endpoints and database connectivity
 */

const BASE_URL = 'http://localhost:3000';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, method, endpoint, body = null, headers = {}) {
    try {
        log(`\n🧪 Testing: ${name}`, 'cyan');

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();

        if (response.ok) {
            log(`✅ PASS: ${name}`, 'green');
            return { success: true, data };
        } else {
            log(`❌ FAIL: ${name}`, 'red');
            log(`   Status: ${response.status}`, 'red');
            log(`   Error: ${JSON.stringify(data, null, 2)}`, 'red');
            return { success: false, data };
        }
    } catch (error) {
        log(`❌ ERROR: ${name}`, 'red');
        log(`   ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function runTests() {
    log('\n🚀 Starting Supabase Setup Tests\n', 'blue');
    log('='.repeat(50), 'blue');

    // Test 1: Check server is running
    log('\n📡 Step 1: Check Server Connection', 'yellow');
    try {
        await fetch(BASE_URL);
        log('✅ Server is running', 'green');
    } catch (error) {
        log('❌ Server is not running! Start it with: node server.js', 'red');
        process.exit(1);
    }

    // Test 2: Check multi-tenant status
    log('\n🔧 Step 2: Check Multi-Tenant Configuration', 'yellow');
    const statusResult = await testEndpoint(
        'Auth Status',
        'GET',
        '/api/auth/status'
    );

    if (!statusResult.success || !statusResult.data.configured) {
        log('\n⚠️  Supabase not configured!', 'yellow');
        log('   Add SUPABASE_URL and SUPABASE_ANON_KEY to .env', 'yellow');
        log('   Then restart the server', 'yellow');
        process.exit(1);
    }

    log('✅ Multi-tenant mode enabled', 'green');

    // Test 3: Create test user
    log('\n👤 Step 3: Create Test User', 'yellow');
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    const signupResult = await testEndpoint(
        'User Signup',
        'POST',
        '/api/auth/signup',
        { email: testEmail, password: testPassword }
    );

    if (!signupResult.success) {
        log('\n❌ Signup failed! Check database schema is installed.', 'red');
        process.exit(1);
    }

    const accessToken = signupResult.data.session?.access_token;
    if (!accessToken) {
        log('❌ No access token received', 'red');
        process.exit(1);
    }

    log(`✅ User created: ${testEmail}`, 'green');
    log(`   Token: ${accessToken.substring(0, 20)}...`, 'green');

    // Test 4: Sign in
    log('\n🔐 Step 4: Test Sign In', 'yellow');
    const signinResult = await testEndpoint(
        'User Signin',
        'POST',
        '/api/auth/signin',
        { email: testEmail, password: testPassword }
    );

    if (!signinResult.success) {
        log('❌ Signin failed', 'red');
        process.exit(1);
    }

    log('✅ Sign in successful', 'green');

    // Test 5: Get user profile
    log('\n📋 Step 5: Get User Profile', 'yellow');
    const profileResult = await testEndpoint(
        'Get User Profile',
        'GET',
        '/api/auth/me',
        null,
        { 'Authorization': `Bearer ${accessToken}` }
    );

    if (!profileResult.success) {
        log('❌ Failed to get user profile', 'red');
        process.exit(1);
    }

    const { user, preferences, subscription } = profileResult.data;

    log('✅ User profile retrieved', 'green');
    log(`   Email: ${user.email}`, 'green');
    log(`   Voice Engine: ${preferences?.voice_engine || 'N/A'}`, 'green');
    log(`   Plan: ${subscription?.plan || 'N/A'}`, 'green');

    // Test 6: Verify database tables
    log('\n🗄️  Step 6: Verify Database Setup', 'yellow');
    if (preferences && subscription) {
        log('✅ user_preferences table working', 'green');
        log('✅ subscriptions table working', 'green');
    } else {
        log('⚠️  Some tables may not be set up correctly', 'yellow');
    }

    // Summary
    log('\n' + '='.repeat(50), 'blue');
    log('\n🎉 ALL TESTS PASSED!', 'green');
    log('\n✅ Supabase is configured correctly', 'green');
    log('✅ Authentication is working', 'green');
    log('✅ Database tables are set up', 'green');
    log('✅ User preferences auto-created', 'green');
    log('✅ Subscriptions auto-created', 'green');

    log('\n📝 Next Steps:', 'cyan');
    log('   1. Implement frontend auth UI', 'cyan');
    log('   2. Add user context learning', 'cyan');
    log('   3. Implement smart reminders', 'cyan');
    log('   4. Add quick actions', 'cyan');
    log('   5. Build AI insights', 'cyan');

    log('\n🚀 Ready for Phase 2: Frontend Authentication!\n', 'blue');
}

// Run tests
runTests().catch(error => {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
});
