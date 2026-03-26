class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: "not_found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

function errorHandler(error, req, res, _next) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;

  res.status(statusCode).json({
    error: statusCode >= 500 ? "internal_error" : "request_error",
    message: error.message || "Unexpected server error",
    details: error.details || null,
  });
}

module.exports = {
  ApiError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};