import { v4 as uuidv4 } from "uuid";

/**
 * requestTracker middleware
 * - Generates a unique X-Request-Id for every incoming request
 * - Reads X-Correlation-Id from caller (Sir's system) and attaches to req
 * - Attaches both to the response headers for end-to-end tracing
 */
export const requestTracker = (req, res, next) => {
  const requestId     = uuidv4();
  const correlationId = req.headers["x-correlation-id"] || null;

  // Attach to req so controllers can use them for logging
  req.requestId     = requestId;
  req.correlationId = correlationId;

  // Send back in response headers
  res.setHeader("X-Request-Id", requestId);
  if (correlationId) {
    res.setHeader("X-Correlation-Id", correlationId);
  }

  next();
};
