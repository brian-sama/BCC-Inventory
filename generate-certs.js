// generate-certs.js - Manual SSL certificate generation
const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating SSL certificates for localhost...');

const attrs = [{ name: 'commonName', value: 'localhost' }];
const options = {
    days: 365,
    keySize: 2048,
    extensions: [{
        name: 'subjectAltName',
        altNames: [
            { type: 2, value: 'localhost' },
            { type: 2, value: '127.0.0.1' },
            { type: 2, value: 'localhost.localdomain' }
        ]
    }]
};

const pems = selfsigned.generate(attrs, options);

// Create ssl directory if it doesn't exist
const sslDir = './ssl';
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

// Save certificates
fs.writeFileSync(path.join(sslDir, 'localhost-key.pem'), pems.private);
fs.writeFileSync(path.join(sslDir, 'localhost-cert.pem'), pems.cert);

console.log('✅ SSL certificates generated successfully!');
console.log('📁 Certificates saved in ./ssl/ directory');
console.log('🔑 Private key: localhost-key.pem');
console.log('📄 Certificate: localhost-cert.pem');