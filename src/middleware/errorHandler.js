/**
 * Unified error handling middleware
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Determine if it's an API request
  const isApi = req.path.startsWith('/api/') || req.headers.accept?.includes('application/json');

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (isApi) {
    return res.status(status).json({
      error: true,
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  }

  // For page requests, render error page
  res.status(status).render('error', {
    title: 'Error',
    message,
    status,
    path: req.path,
  });
}

/**
 * Create an error with status code
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, createError };
