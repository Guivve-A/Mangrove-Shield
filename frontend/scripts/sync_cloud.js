const admin = require('firebase-admin');
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
                else reject(new Error('Failed to get access token: ' + body));
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function seed() {
    const cachePath = path.join(__dirname, '../public/data/api_cache.json');
    const rawData = fs.readFileSync(cachePath, 'utf8');
    const data = JSON.parse(rawData);

    try {
        const accessToken = await getAccessToken();
        console.log('Obtained access token. Seeding Firestore...');

        // Initialize admin SDK with the access token
        admin.initializeApp({
            credential: admin.credential.cert({
                // Dummy certificate structure to make it work with the token
                projectId: PROJECT_ID,
                clientEmail: 'dummy@example.com',
                privateKey: '-----BEGIN PRIVATE KEY-----\ndummy\n-----END PRIVATE KEY-----\n'
            }),
            projectId: PROJECT_ID
        });

        // Actually, simpler to just use the REST API here
        const options = {
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/api_cache/flood_status?updateMask.fieldPaths=weather&updateMask.fieldPaths=tide&updateMask.fieldPaths=sar_data&updateMask.fieldPaths=ecosystem_health&updateMask.fieldPaths=risk_assessment`,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        // Firestore REST requires a specific JSON format (Value types)
        // For simplicity in this script, we'll just push the data fields as a whole
        // Actually, the REST API is verbose. I'll use the 'firebase-admin' if I can bypass cert check.
    } catch (e) {
        console.error(e);
    }
}
