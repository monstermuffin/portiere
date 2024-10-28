const express = require('express');
const path = require('path');
const crypto = require('crypto');
const ejs = require('ejs');

// We'll import fetch dynamically
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

const app = express();
const port = process.env.PORT || 3000;

// Env vars
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const TEST_MODE = process.env.TEST_MODE === 'true';
const STORED_HASH = process.env.STORED_HASH;
// Default 24h - env var override added
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MINS || '1440') * 60 * 1000;

// Session storage in memory
const sessions = new Map();

app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));

// Middleware to parse JSON and serve static files
app.use(express.static('public'));
app.use(express.json());

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex'); // Should be enough
}

// Middleware to verify session
const authenticateSession = (req, res, next) => {
    const sessionToken = req.headers['x-auth-token'];
    
    if (!sessionToken || !sessions.has(sessionToken)) {
        console.log(`[${new Date().toISOString()}] ${req.ip} => Unauthorised access attempt`);
        return res.status(401).json({ success: false, error: 'Unauthorised' });
    }
    
    // Check if session has expired
    const session = sessions.get(sessionToken);
    if (Date.now() - session.created > SESSION_TIMEOUT) {
        sessions.delete(sessionToken);
        return res.status(401).json({ success: false, error: 'Session expired' });
    }
    
    next();
};

// Middleware to log all requests with IP - need headers, CFTUN working confirmed
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${ip} => ${req.method} ${req.path}`);
    next();
});

// Root route for rendering the page
app.get('/', (req, res) => {
    res.render('index', {
        useParticles: process.env.USE_PARTICLES === 'true'
    });
});

// Endpoint for authentication
app.post('/api/auth', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const { hash } = req.body;
    
    if (!hash) {
        return res.status(400).json({ success: false, error: 'Missing hash' });
    }
    
    if (hash === STORED_HASH) {
        const sessionToken = generateSessionToken();
        sessions.set(sessionToken, {
            created: Date.now(),
            ip: ip
        });
        
        console.log(`[${new Date().toISOString()}] ${ip} => Authentication successful`);
        return res.json({ success: true, token: sessionToken });
    }
    
    console.log(`[${new Date().toISOString()}] ${ip} => Authentication failed`);
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// Protecc
app.post('/api/log', authenticateSession, (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const { event, details } = req.body;
    console.log(`[${new Date().toISOString()}] ${ip} => ${event}${details ? ': ' + details : ''}`);
    res.json({ success: true });
});

app.post('/api/unlock', authenticateSession, async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (TEST_MODE) {
        console.log(`[${new Date().toISOString()}] ${ip} => TEST MODE: Unlock triggered`);
        return res.json({ success: true, message: 'Test mode: Webhook not triggered' });
    }

    if (!fetch) {
        return res.status(500).json({ success: false, error: 'Server not ready' });
    }

    try {
        console.log(`[${new Date().toISOString()}] ${ip} => Triggering webhook`);
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'unlock' })
        });

        if (!response.ok) {
            throw new Error(`Webhook request failed: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        }

        console.log(`[${new Date().toISOString()}] ${ip} => Webhook triggered successfully`);
        res.json({ success: true, data });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ${ip} => Error triggering webhook:`, error);
        res.status(500).json({ success: false, error: 'Failed to trigger webhook' });
    }
});

// Cleanup expired sessions 
setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    for (const [token, session] of sessions.entries()) {
        if (now - session.created > SESSION_TIMEOUT) {
            sessions.delete(token);
            expiredCount++;
        }
    }
    if (expiredCount > 0) {
        console.log(`[${new Date().toISOString()}] Cleaned up ${expiredCount} expired sessions`);
    }
}, 5 * 60 * 1000);

// Log configuration on startup
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Session timeout set to ${SESSION_TIMEOUT / (60 * 1000)} minutes`);
    console.log(`Test mode: ${TEST_MODE}`);
});