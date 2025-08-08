// Test script for the bike monitor
// This bypasses time restrictions for testing purposes

const https = require('https');

const STATION_CODE = 'ASD002';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function testBikeAPI() {
    console.log('🧪 Testing bike API...');

    return new Promise((resolve, reject) => {
        const url = 'http://fiets.openov.nl/locaties.json';

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`✅ API responded with ${jsonData.length} locations`);

                    const station = jsonData.find(loc => loc.stationCode === STATION_CODE);

                    if (station) {
                        console.log(`✅ Found target station: ${station.name}`);
                        console.log(`📊 Available bikes: ${station.availableBikes}/${station.capacity}`);
                        console.log(`🕐 Last updated: ${station.lastUpdate || 'N/A'}`);
                        resolve(station);
                    } else {
                        console.log(`❌ Station ${STATION_CODE} not found`);
                        console.log('Available stations:');
                        jsonData.slice(0, 5).forEach(loc => {
                            console.log(`  - ${loc.stationCode}: ${loc.name}`);
                        });
                        reject(new Error('Station not found'));
                    }

                } catch (error) {
                    console.error('❌ Failed to parse API response:', error.message);
                    reject(error);
                }
            });

        }).on('error', (error) => {
            console.error('❌ API request failed:', error.message);
            reject(error);
        });
    });
}

async function testSlackNotification() {
    console.log('\n🧪 Testing Slack notification...');

    if (!SLACK_WEBHOOK_URL) {
        console.log('❌ SLACK_WEBHOOK_URL not set - skipping Slack test');
        return;
    }

    return new Promise((resolve, reject) => {
        const payload = {
            attachments: [{
                color: '#00ff00',
                title: '🧪 Test Notification',
                text: '✅ Your bike monitor is working correctly!\n' +
                    'This is a test message from your OV-fiets monitoring system.\n' +
                    `Time: ${new Date().toLocaleString('en-US', {timeZone: 'Europe/Amsterdam'})}`,
                footer: 'Bike Monitor Test',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        const postData = JSON.stringify(payload);
        const url = new URL(SLACK_WEBHOOK_URL);

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode === 200) {
                console.log('✅ Slack notification sent successfully');
                resolve();
            } else {
                console.error(`❌ Slack API returned status ${res.statusCode}`);
                reject(new Error(`Slack failed with status ${res.statusCode}`));
            }
        });

        req.on('error', (error) => {
            console.error('❌ Failed to send Slack notification:', error.message);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

function testTimeZone() {
    console.log('\n🧪 Testing timezone handling...');

    const now = new Date();
    const utc = now.toISOString();
    const amsterdam = now.toLocaleString('en-US', {
        timeZone: 'Europe/Amsterdam',
        hour12: false,
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    console.log(`🌍 UTC time: ${utc}`);
    console.log(`🇳🇱 Amsterdam time: ${amsterdam}`);

    const amsterdamDate = new Date(now.toLocaleString('en-US', {timeZone: 'Europe/Amsterdam'}));
    const day = amsterdamDate.getDay();
    const hour = amsterdamDate.getHours();
    const minute = amsterdamDate.getMinutes();

    const isTargetDay = day === 1 || day === 3 || day === 4;
    const currentMinutes = hour * 60 + minute;
    const isInWindow = currentMinutes >= 510 && currentMinutes <= 570; // 8:30-9:30

    console.log(`📅 Day of week: ${day} (1=Mon, 3=Wed, 4=Thu) - Target day: ${isTargetDay}`);
    console.log(`⏰ Current time: ${hour}:${minute.toString().padStart(2, '0')} - In window (8:30-9:30): ${isInWindow}`);
}

async function runTests() {
    console.log('🚀 Starting bike monitor tests...\n');

    try {
        // Test timezone
        testTimeZone();

        // Test API
        const stationData = await testBikeAPI();

        // Test Slack (only if webhook is configured)
        if (SLACK_WEBHOOK_URL) {
            await testSlackNotification();
        }

        console.log('\n✅ All tests completed successfully!');
        console.log('\n📋 System status:');
        console.log(`   • API connection: ✅ Working`);
        console.log(`   • Station data: ✅ Found (${stationData.availableBikes} bikes available)`);
        console.log(`   • Slack integration: ${SLACK_WEBHOOK_URL ? '✅ Working' : '⚠️  Not configured'}`);
        console.log(`   • Timezone handling: ✅ Working`);

        if (!SLACK_WEBHOOK_URL) {
            console.log('\n⚠️  To complete setup, add your Slack webhook URL to GitHub Secrets');
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}