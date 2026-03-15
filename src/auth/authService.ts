import { PrismaClient, User, Organization } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthService');

export interface AuthTokenPayload {
  userId: string;
  organizationId: string;
  role: string;
}

export class AuthService {
  private prisma: PrismaClient;
  private pool: Pool;
  private jwtSecret: string;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for AuthService');
    }

    this.jwtSecret = process.env.JWT_SECRET || '';
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET is required for authentication');
    }

    this.pool = new Pool({ connectionString });
    const adapter = new PrismaPg(this.pool as any);

    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    logger.info('AuthService initialized');
  }

  async createOrganization(name: string): Promise<Organization> {
    const organization = await this.prisma.organization.create({
      data: { name },
    });

    logger.info('[ORG_CREATED]', { organizationId: organization.id, name: organization.name });

    return organization;
  }

  async createUser(params: {
    email: string;
    password: string;
    role: string;
    organizationId: string;
  }): Promise<User> {
    const { email, password, role, organizationId } = params;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        organizationId,
      },
    });

    logger.info('[USER_CREATED]', { userId: user.id, email: user.email, organizationId });

    return user;
  }

  async validateUser(email: string, password: string): Promise<AuthTokenPayload | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    const payload: AuthTokenPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };

    logger.info('[LOGIN_SUCCESS]', { userId: user.id, email: user.email });

    return payload;
  }

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '12h' });
  }

  verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, this.jwtSecret) as AuthTokenPayload;
  }
}

