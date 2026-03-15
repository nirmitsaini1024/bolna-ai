import { Request, Response } from 'express';
import { AuthService } from './authService';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const { organizationName, email, password, role } = req.body as {
      organizationName: string;
      email: string;
      password: string;
      role?: string;
    };

    if (!organizationName || !email || !password) {
      res.status(400).json({ error: 'organizationName, email, and password are required' });
      return;
    }

    const organization = await authService.createOrganization(organizationName);
    const user = await authService.createUser({
      email,
      password,
      role: role || 'admin',
      organizationId: organization.id,
    });

    const payload = {
      userId: user.id,
      organizationId: organization.id,
      role: user.role,
    };

    const token = authService.generateToken(payload);

    res.status(201).json({
      token,
      organizationId: organization.id,
      userId: user.id,
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const payload = await authService.validateUser(email, password);

    if (!payload) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = authService.generateToken(payload);

    res.status(200).json({
      token,
      organizationId: payload.organizationId,
      userId: payload.userId,
      role: payload.role,
    });
  }
}

