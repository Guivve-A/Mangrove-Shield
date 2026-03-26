const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize with Application Default Credentials or the active project
admin.initializeApp({
  projectId: 'studio-8904974087-7cc0a'
});

const db = admin.firestore();

async function seed() {
  const cachePath = path.join(__dirname, '../public/data/api_cache.json');
  const rawData = fs.readFileSync(cachePath, 'utf8');
  const data = JSON.parse(rawData);

  console.log('Seeding MangroveShield live data to Firestore...');
  
  try {
    await db.collection('api_cache').doc('flood_status').set(data);
    console.log('✅ Success! Firestore cache is now live.');
  } catch (error) {
    console.error('❌ Error seeding Firestore:', error);
    process.exit(1);
  }
}

seed();
