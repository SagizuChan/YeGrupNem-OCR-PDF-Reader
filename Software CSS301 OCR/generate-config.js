const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const cfg = {
  GAPI_API_KEY: process.env.GAPI_API_KEY || '',
  GAPI_CLIENT_ID: process.env.GAPI_CLIENT_ID || ''
};

fs.writeFileSync(path.join(__dirname, 'config.js'), 'window.CONFIG = ' + JSON.stringify(cfg, null, 2) + ';', 'utf8');
console.log('Wrote config.js');