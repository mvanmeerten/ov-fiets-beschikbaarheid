# 🚲 OV-fiets Bike Availability Monitor

Automated monitoring system that notifies you via Slack when bike availability at Amsterdam Centraal Oost falls below 20
bikes on Monday, Wednesday, and Thursday mornings (8:30-9:30 AM CEST).

## 🎯 Features

- ✅ **Scheduled monitoring** on specific days and times
- ✅ **Smart notifications** - alerts when bikes < 20, recovery when bikes ≥ 20
- ✅ **Timezone aware** - automatically handles CEST/CET transitions
- ✅ **No spam** - stops checking after threshold is hit, only monitors for recovery
- ✅ **Completely free** - runs on GitHub Actions
- ✅ **Error handling** - notifies you if the system fails

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Slack Webhook

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Name it "Bike Monitor" and select your workspace
4. Go to **"Incoming Webhooks"** → Toggle **"Activate Incoming Webhooks"**
5. Click **"Add New Webhook to Workspace"**
6. Select the channel where you want notifications
7. **Copy the webhook URL** (starts with `https://hooks.slack.com/services/...`)

### Step 2: Setup GitHub Repository

1. **Fork or create a new repository** with these files
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `SLACK_WEBHOOK_URL`
5. Value: Paste your Slack webhook URL from Step 1
6. Click **"Add secret"**

### Step 3: Enable GitHub Actions

1. Go to the **"Actions"** tab in your repository
2. If prompted, click **"I understand my workflows, go ahead and enable them"**
3. The workflow will now run automatically on schedule

## 📁 File Structure

```
your-repo/
├── bike-monitor.js              # Main monitoring script
├── .github/workflows/
│   └── bike-monitor.yml         # GitHub Actions workflow
├── package.json                 # Project configuration
├── test-monitor.js              # Test script
└── README.md                    # This file
```

## 🧪 Testing Your Setup

Run the test script to verify everything works:

```bash
# Set your webhook URL temporarily for testing
export SLACK_WEBHOOK_URL="your_webhook_url_here"

# Run the test
node src/test-monitor.js
```

Or test manually in GitHub Actions:

1. Go to **Actions** tab
2. Click **"Bike Availability Monitor"**
3. Click **"Run workflow"** → **"Run workflow"**

## ⚙️ How It Works

### Monitoring Schedule

- **Days**: Monday, Wednesday, Thursday
- **Time**: 8:30 AM - 9:30 AM (Europe/Amsterdam timezone)
- **Frequency**: Every 1 minute during the time window
- **Auto-stop**: Stops checking when bikes < 20 (continues monitoring for recovery)

### Notification Logic

1. **Low availability alert** (🔴): When bikes drop below 20
2. **Recovery alert** (🟢): When bikes become available again (≥20) after being low
3. **Error alerts** (❌): If the system encounters problems

### Smart Features

- **Daily reset**: State resets each day for fresh monitoring
- **Timezone handling**: Automatically adjusts for CEST/CET
- **Duplicate prevention**: Won't spam you with repeated low-bike alerts
- **State persistence**: Remembers status between runs using GitHub artifacts

## 🔧 Configuration

### Change Target Station

Edit `STATION_CODE` in `bike-monitor.js`:

```javascript
const STATION_CODE = 'ASD002'; // Amsterdam Centraal Oost
```

### Change Bike Threshold

Edit `BIKE_THRESHOLD` in `bike-monitor.js`:

```javascript
const BIKE_THRESHOLD = 20; // Alert when below this number
```

### Change Schedule

Edit the cron schedule in `.github/workflows/bike-monitor.yml`:

```yaml
schedule:
  - cron: '30 6 * * 1,3,4'  # Summer time (CEST)
  - cron: '30 7 * * 1,3,4'  # Winter time (CET)
```

## 📊 Data Source

This system uses the free OpenOV API (`http://fiets.openov.nl/locaties.json`) which provides real-time bike availability
for all OV-fiets locations in the Netherlands.

**Station Details:**

- **Name**: Amsterdam Centraal Oost
- **Code**: ASD002
- **Location**: Stationsplein 5, Amsterdam
- **Operating Hours**: Monday-Friday 07:00-24:00, weekends vary

## 🛠️ Troubleshooting

### No Notifications Received

1. Check Slack webhook URL in GitHub Secrets
2. Verify the webhook channel permissions
3. Run the test script to check all components

### Wrong Time Zone

The system automatically handles CEST/CET. If notifications come at wrong times:

1. Check your local time vs Amsterdam time
2. Verify GitHub Actions cron schedule

### API Errors

If bike data can't be fetched:

1. Check if `http://fiets.openov.nl/locaties.json` is accessible
2. Verify station code `ASD002` exists in the API response

### GitHub Actions Not Running

1. Ensure GitHub Actions are enabled in repository settings
2. Check if you have sufficient GitHub Actions minutes (free tier: 2000 min/month)

## 📱 Example Notifications

**Low Availability Alert:**

```
🚲 OV-fiets Availability Alert
⚠️ Low bike availability at Amsterdam Centraal Oost
Only 15 bikes available (threshold: 20)
Total capacity: 391
Time: Wednesday, 08/14/2024, 08:45
```

**Recovery Alert:**

```
🚲 OV-fiets Availability Alert
✅ Bikes available again at Amsterdam Centraal Oost
Now 25 bikes available
Total capacity: 391
Time: Wednesday, 08/14/2024, 09:15
```

## 🔒 Security & Privacy

- ✅ No personal data stored or transmitted
- ✅ Slack webhook URL encrypted in GitHub Secrets
- ✅ Open source - audit the code yourself
- ✅ Uses official public APIs only

## 📈 Cost Analysis

**Completely Free!**

- ✅ GitHub Actions: Free tier (2000 minutes/month)
- ✅ OpenOV API: Free public API
- ✅ Slack: Free webhook integration
- ✅ This system uses ~60 minutes/month (well within free limits)

## 🤝 Contributing

Feel free to submit issues or pull requests to improve the system!

## 📄 License

MIT License - feel free to modify and distribute.

---

**Made with ❤️ for Dutch bike commuters**