/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse and DoS attacks.
 * Uses express-rate-limit for request throttling.
 *
 * Security Priority: CRITICAL
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Applied to all /api/* routes
 * More lenient in development to allow Vite HMR and rapid testing
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 in dev, 100 in prod
  message: {
    error: "Trop de requêtes, veuillez réessayer plus tard.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

/**
 * Stricter rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts per 15 minutes
  message: {
    error: "Trop de tentatives de connexion. Veuillez réessayer plus tard.",
    retryAfter: "15 minutes"
  },
  skipSuccessfulRequests: true, // Don't count successful authentications
});

/**
 * File upload rate limiter (CRITICAL for task attachments)
 * Prevents storage exhaustion attacks
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    error: "Limite de téléversement atteinte. Maximum 10 fichiers par heure.",
    retryAfter: "1 hour"
  }
});

/**
 * Task creation rate limiter
 * Prevents task spam
 */
export const taskCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 tasks per hour
  message: {
    error: "Limite de création de tâches atteinte. Maximum 50 tâches par heure.",
    retryAfter: "1 hour"
  }
});

/**
 * Comment rate limiter
 * Prevents comment spam
 */
export const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 comments per 15 minutes
  message: {
    error: "Trop de commentaires. Veuillez réessayer plus tard.",
    retryAfter: "15 minutes"
  }
});

/**
 * Board creation rate limiter
 * Prevents workspace spam
 */
export const boardCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 boards per day
  message: {
    error: "Limite de création de tableaux atteinte. Maximum 10 tableaux par jour.",
    retryAfter: "24 hours"
  }
});
