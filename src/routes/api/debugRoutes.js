/**
 * Debug Routes
 * Provides routes for debugging purposes during development.
 */

const express = require('express');
const router = express.Router();
const debugHandlers = require('../../handlers/debugHandlers');

// Middleware to restrict access in production (optional but recommended)
// router.use((req, res, next) => {
//   if (process.env.NODE_ENV === 'production') {
//     return res.status(403).send('Forbidden: Debug routes are disabled in production.');
//   }
//   next();
// });

/**
 * @route GET /api/debug/
 * @desc Serves the main debug dashboard page
 * @access Development only
 */
router.get('/', debugHandlers.handleGetDebugDashboard);

/**
 * @route GET /api/debug/rooms
 * @desc Get all active rooms
 * @access Development only
 */
router.get('/rooms', debugHandlers.handleGetActiveRooms);

/**
 * @route GET /api/debug/sessions
 * @desc Get all active sessions
 * @access Development only
 */
router.get('/sessions', debugHandlers.handleGetActiveSessions);


module.exports = router; 