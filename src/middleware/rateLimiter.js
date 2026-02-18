/**
 * In-memory rate limiter & scanner protection middleware
 * - Global rate limit: max requests per window per IP
 * - 404 auto-ban: IPs generating excessive 404s get temporarily banned
 * - Periodic cleanup to prevent memory leaks
 */

import { warn } from '../utils/logger.js';

// --- Configuration ---
const RATE_LIMIT_WINDOW_MS = 60 * 1000;       // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;           // max requests per window
const BAN_404_THRESHOLD = 10;                  // 404 hits before ban
const BAN_404_WINDOW_MS = 5 * 60 * 1000;      // 5 minutes window for 404 counting
const BAN_DURATION_MS = 30 * 60 * 1000;        // 30 minutes ban
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;    // cleanup every 10 minutes

// --- In-memory stores ---
const requestCounts = new Map();  // ip -> { count, resetTime }
const notFoundCounts = new Map(); // ip -> { count, windowStart }
const bannedIPs = new Map();      // ip -> banExpiry timestamp

// --- Known scanner paths (never need to be served) ---
const SCANNER_PATH_PATTERNS = [
    /\.php/i,
    /\.asp/i,
    /\.aspx/i,
    /\/phpMyAdmin/i,
    /\/phpmyadmin/i,
    /\/admin\//i,
    /\/wp-admin/i,
    /\/wp-login/i,
    /\/nacos/i,
    /\/cwbase/i,
    /\/weboffice/i,
    /\/wcm\//i,
    /\/env$/i,
    /\/\.env/i,
    /\/v1\/models/i,
    /\/v2\/logging/i,
    /\/ofbiz/i,
    /\/actuator/i,
    /\/console/i,
    /\/manager\//i,
    /\/solr\//i,
    /\/jenkins/i,
    /\/config\.json/i,
];

/**
 * Check if a path matches known scanner patterns
 */
function isScannerPath(path) {
    return SCANNER_PATH_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Periodic cleanup of expired entries to prevent memory leaks
 */
setInterval(() => {
    const now = Date.now();

    // Cleanup expired bans
    for (const [ip, expiry] of bannedIPs) {
        if (now > expiry) bannedIPs.delete(ip);
    }

    // Cleanup stale request counts
    for (const [ip, data] of requestCounts) {
        if (now > data.resetTime) requestCounts.delete(ip);
    }

    // Cleanup stale 404 counts
    for (const [ip, data] of notFoundCounts) {
        if (now > data.windowStart + BAN_404_WINDOW_MS) notFoundCounts.delete(ip);
    }
}, CLEANUP_INTERVAL_MS);

/**
 * Record a 404 hit for an IP — called from the 404 handler
 */
export function record404(ip) {
    const now = Date.now();
    const entry = notFoundCounts.get(ip);

    if (!entry || now > entry.windowStart + BAN_404_WINDOW_MS) {
        // Start new window
        notFoundCounts.set(ip, { count: 1, windowStart: now });
    } else {
        entry.count++;
        if (entry.count >= BAN_404_THRESHOLD) {
            bannedIPs.set(ip, now + BAN_DURATION_MS);
            notFoundCounts.delete(ip);
            warn(`IP auto-banned for excessive 404s: ${ip} (banned for ${BAN_DURATION_MS / 60000} min)`);
        }
    }
}

/**
 * Main rate limiter middleware
 */
export function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    // 1. Check if IP is banned
    const banExpiry = bannedIPs.get(ip);
    if (banExpiry) {
        if (now < banExpiry) {
            return res.status(403).end();
        }
        // Ban expired, remove it
        bannedIPs.delete(ip);
    }

    // 2. Instant-block known scanner paths (don't even rate-count them)
    if (isScannerPath(req.path)) {
        record404(ip);
        return res.status(404).end();
    }

    // 3. Global rate limit check
    const entry = requestCounts.get(ip);
    if (!entry || now > entry.resetTime) {
        requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else {
        entry.count++;
        if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
            warn(`Rate limit exceeded for IP: ${ip}`);
            return res.status(429).json({
                error: 'too_many_requests',
                message: 'Too many requests, please slow down.',
                retryAfter: Math.ceil((entry.resetTime - now) / 1000)
            });
        }
    }

    next();
}

export default rateLimiter;
