const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
const https = require('https');

const REFRESH_TOKEN = 'your_refresh_token_here';
const PROJECT_ID = 'studio-8904974087-7cc0a';
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';

async function sync() {
    console.log('Starting Cloud Sync v2 (Secure Auth)...');
    
    // We attempt to get the access token using the Refresh Token
    // Note: Since this is a CLI token, we might need to use its logic
    const client = new OAuth2Client(CLIENT_ID);
    client.setCredentials({ refresh_token: REFRESH_TOKEN });

    try {
        const { token } = await client.getAccessToken();
        console.log('Access Token Obtained! Updating Firestore documents...');

        const cachePath = path.join(__dirname, '../public/data/api_cache.json');
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

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
        const options = {
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/api_cache/flood_status`,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ CLOUD SYNC SUCCESS: MangroveShield is now Live!');
                } else {
                    console.error(`❌ Sync Failed (${res.statusCode}):`, body);
                }
            });
        });

        req.on('error', (e) => console.error('REST Error:', e));
        req.write(payload);
        req.end();

    } catch (e) {
        console.error('Auth Error:', e.message);
        process.exit(1);
    }
}

sync();
