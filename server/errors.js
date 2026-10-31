export class AppError extends Error {
  constructor(status, message, code = undefined, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Please sign in again.') => new AppError(401, message, 'unauthorized');
export const forbidden = (message = 'You do not have access to that.') => new AppError(403, message, 'forbidden');
export const notFound = (message = 'Not found.') => new AppError(404, message, 'not_found');
export const conflict = (message, code = 'conflict') => new AppError(409, message, code);

// Express 4 does not catch rejected promises automatically.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
