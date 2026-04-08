const crypto = require('crypto');

// Generate a secure random token
function generateDatabaseAuthToken() {
    // Generate 32 bytes of random data and convert to hex (64 characters)
    const token = crypto.randomBytes(32).toString('hex');
    return token;
}

// Generate the token
const DATABASE_AUTH_TOKEN = generateDatabaseAuthToken();

console.log('DATABASE_AUTH_TOKEN:', DATABASE_AUTH_TOKEN);

// Also output as environment variable format
console.log('\nEnvironment variable format:');
console.log(`DATABASE_AUTH_TOKEN=${DATABASE_AUTH_TOKEN}`);

// Export for use in other modules
module.exports = { generateDatabaseAuthToken };