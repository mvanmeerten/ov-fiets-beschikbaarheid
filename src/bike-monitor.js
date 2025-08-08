const https = require('https');
const fs = require('fs');

// Configuration
const STATION_CODE = 'ASD002'; // Amsterdam Centraal Oost
const BIKE_THRESHOLD = 20;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const STATE_FILE = 'notification_state.json';

// State management
let state = {
    lastNotificationSent: null,
    bikesWentBelowThreshold: false,
    bikesRecovered: false,
    lastBikeCount: null
};

// Load existing state if available
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            state = {...state, ...JSON.parse(data)};
            console.log('Loaded state:', state);
        }
    } catch (error) {
        console.log('No previous state found, starting fresh');
    }
}

// Save state
function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        console.log('State saved:', state);
    } catch (error) {
        console.error('Failed to save state:', error);
    }
}

// Get current time in CEST/CET (handles DST automatically)
function getCurrentTimeInEurope() {
    return new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Amsterdam',
        hour12: false,
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Check if current time is in monitoring window
function isInMonitoringWindow() {
    const now = new Date();
    const amsterdamTime = new Date(now.toLocaleString('en-US', {timeZone: 'Europe/Amsterdam'}));

    const day = amsterdamTime.getDay(); // 0=Sunday, 1=Monday, etc.
    const hour = amsterdamTime.getHours();
    const minute = amsterdamTime.getMinutes();
    const currentMinutes = hour * 60 + minute;

    // Monday=1, Wednesday=3, Thursday=4
    const isTargetDay = day === 1 || day === 3 || day === 4;

    // 8:30 AM = 510 minutes, 9:30 AM = 570 minutes
    const isInTimeWindow = currentMinutes >= 510 && currentMinutes <= 570;

    console.log(`Current time: ${getCurrentTimeInEurope()}, Day: ${day}, Target day: ${isTargetDay}, In time window: ${isInTimeWindow}`);

    return isTargetDay && isInTimeWindow;
}

// Reset daily state if it's a new day
function resetDailyStateIfNeeded() {
    const today = new Date().toDateString();
    if (state.lastNotificationSent && new Date(state.lastNotificationSent).toDateString() !== today) {
        console.log('New day detected, resetting daily state');
        state.bikesWentBelowThreshold = false;
        state.bikesRecovered = false;
        state.lastBikeCount = null;
        saveState();
    }
}

// Fetch bike availability data
async function fetchBikeData() {
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

                    // Find our station
                    const station = jsonData.find(loc => loc.stationCode === STATION_CODE);

                    if (!station) {
                        reject(new Error(`Station ${STATION_CODE} not found in API response`));
                        return;
                    }

                    console.log(`Found station: ${station.name} (${station.stationCode})`);
                    console.log(`Available bikes: ${station.availableBikes}/${station.capacity}`);

                    resolve({
                        stationName: station.name,
                        availableBikes: station.availableBikes,
                        capacity: station.capacity,
                        fetchTime: new Date().toISOString()
                    });

                } catch (error) {
                    reject(new Error(`Failed to parse API response: ${error.message}`));
                }
            });

        }).on('error', (error) => {
            reject(new Error(`API request failed: ${error.message}`));
        });
    });
}

// Send Slack notification
async function sendSlackNotification(message, color = '#ff9500') {
    return new Promise((resolve, reject) => {
        if (!SLACK_WEBHOOK_URL) {
            reject(new Error('SLACK_WEBHOOK_URL environment variable not set'));
            return;
        }

        const payload = {
            attachments: [{
                color: color,
                title: '🚲 OV-fiets Availability Alert',
                text: message,
                footer: 'Bike Monitor',
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
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('Slack notification sent successfully');
                    resolve();
                } else {
                    reject(new Error(`Slack API returned status ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Failed to send Slack notification: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

// Main monitoring logic
async function checkBikes() {
    try {
        console.log('\n=== Bike Availability Check ===');
        console.log(`Time: ${getCurrentTimeInEurope()}`);

        // Load state and reset if new day
        loadState();
        resetDailyStateIfNeeded();

        // Check if we're in the monitoring window
        if (!isInMonitoringWindow()) {
            console.log('Outside monitoring window, skipping check');
            return;
        }

        console.log('In monitoring window, checking bike availability...');

        // Fetch current bike data
        const bikeData = await fetchBikeData();
        const currentBikes = bikeData.availableBikes;

        console.log(`Current bikes available: ${currentBikes}`);
        console.log(`Previous bike count: ${state.lastBikeCount}`);
        console.log(`Below threshold already notified: ${state.bikesWentBelowThreshold}`);
        console.log(`Recovery already notified: ${state.bikesRecovered}`);

        // Check for low availability (< 20 bikes)
        if (currentBikes < BIKE_THRESHOLD && !state.bikesWentBelowThreshold) {
            const message = `⚠️ *Low bike availability at ${bikeData.stationName}*\n` +
                `Only *${currentBikes}* bikes available (threshold: ${BIKE_THRESHOLD})\n` +
                `Total capacity: ${bikeData.capacity}\n` +
                `Time: ${getCurrentTimeInEurope()}`;

            await sendSlackNotification(message, '#ff0000');

            state.bikesWentBelowThreshold = true;
            state.bikesRecovered = false; // Reset recovery flag
            state.lastNotificationSent = new Date().toISOString();

            console.log('LOW AVAILABILITY notification sent!');
        }

        // Check for recovery (>= 20 bikes after being below threshold)
        else if (currentBikes >= BIKE_THRESHOLD &&
            state.bikesWentBelowThreshold &&
            !state.bikesRecovered &&
            state.lastBikeCount !== null &&
            state.lastBikeCount < BIKE_THRESHOLD) {

            const message = `✅ *Bikes available again at ${bikeData.stationName}*\n` +
                `Now *${currentBikes}* bikes available\n` +
                `Total capacity: ${bikeData.capacity}\n` +
                `Time: ${getCurrentTimeInEurope()}`;

            await sendSlackNotification(message, '#00ff00');

            state.bikesRecovered = true;
            state.lastNotificationSent = new Date().toISOString();

            console.log('RECOVERY notification sent!');
        }

        // Update state
        state.lastBikeCount = currentBikes;
        saveState();

        // Stop monitoring if we've gone below threshold (prevents spam)
        if (state.bikesWentBelowThreshold) {
            console.log('Threshold already hit today, monitoring will continue for recovery notifications only');
        }

    } catch (error) {
        console.error('Error in bike check:', error.message);

        // Send error notification to Slack
        try {
            const errorMessage = `❌ *Bike Monitor Error*\n` +
                `Failed to check bike availability\n` +
                `Error: ${error.message}\n` +
                `Time: ${getCurrentTimeInEurope()}`;

            await sendSlackNotification(errorMessage, '#ff0000');
        } catch (slackError) {
            console.error('Failed to send error notification to Slack:', slackError.message);
        }
    }
}

// Run the check
if (require.main === module) {
    checkBikes();
}