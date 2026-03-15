import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthTokenPayload } from './authService';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.substring('Bearer '.length);

  try {
    const payload = authService.verifyToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

