function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    status,
    message: err.message,
    stack: err.stack,
    userId: req.user?.id,
  });

  // Never expose internal error details to the client
  const message = status >= 500 ? 'Internal Server Error' : err.message;
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
