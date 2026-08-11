class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = null) {
    super(message);
    this.statusCode  = statusCode;
    this.errorCode   = errorCode;   // machine-readable code e.g. ERR_INSUFFICIENT_CREDITS
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
