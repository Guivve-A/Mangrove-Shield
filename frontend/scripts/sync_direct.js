const fs = require('fs');
const path = require('path');
const https = require('https');

const REFRESH_TOKEN = 'your_refresh_token_here';
const PROJECT_ID = 'studio-8904974087-7cc0a';
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';

async function getAccessToken() {
    return new Promise((resolve, reject) => {
        const data = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: CLIENT_ID,
            refresh_token: REFRESH_TOKEN
        }).toString();

        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                const json = JSON.parse(body);
                if (json.access_token) resolve(json.access_token);
                else reject(new Error('Refresh failed - Token might be expired or used once. Check: ' + body));
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function patchFirestore(token, data) {
    const doc = {
        fields: {
            weather: { mapValue: { fields: {
                rain_mm: { doubleValue: data.weather.rain_mm },
                temp_c: { doubleValue: data.weather.temp_c },
                source: { stringValue: data.weather.source }
            }}},
            tide: { mapValue: { fields: {
                level_m: { doubleValue: data.tide.level_m },
                source: { stringValue: data.tide.source }
            }}},
            risk_assessment: { mapValue: { fields: {
                level: { stringValue: data.risk_assessment.level },
                score: { doubleValue: data.risk_assessment.score }
            }}},
            sar_data: { mapValue: { fields: {
                tile_url: { stringValue: data.sar_data.tile_url },
                date_acquired: { stringValue: data.sar_data.date_acquired },
                flood_anomaly_fraction: { doubleValue: data.sar_data.flood_anomaly_fraction }
            }}},
            ecosystem_health: { mapValue: { fields: {
                health_index: { doubleValue: data.ecosystem_health.health_index },
                classification: { stringValue: data.ecosystem_health.classification },
                date_acquired: { stringValue: data.ecosystem_health.date_acquired }
            }}}
        }
    };

    const payload = JSON.stringify(doc);
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/api_cache/flood_status`,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                if (res.statusCode === 200) resolve(body);
                else reject(new Error(`Update failed (${res.statusCode}): ` + body));
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function run() {
    const cachePath = path.join(__dirname, '../public/data/api_cache.json');
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

    try {
        const token = await getAccessToken();
        console.log('Token refreshed! Syncing to Firestore...');
        await patchFirestore(token, data);
        console.log('✅ SEED SUCCESS!');
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

run();
