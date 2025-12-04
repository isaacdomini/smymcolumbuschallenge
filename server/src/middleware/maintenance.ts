import type { Request, Response, NextFunction } from 'express';

export const maintenanceCheck = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    // Allow bypassing with a secret header if needed in the future, 
    // but for now strict blocking as requested.
    // We can add a bypass check here later if the user requests it.

    // Check if it's an API request
    if (req.path.startsWith('/api')) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'The server is currently down for maintenance. Please try again later.'
      });
    }
  }
  next();
};
