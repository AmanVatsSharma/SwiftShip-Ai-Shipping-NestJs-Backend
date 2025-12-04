import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

/**
 * Auth Service
 *
 * Provides comprehensive authentication and authorization functionality.
 *
 * Features:
 * - User registration with password hashing
 * - Email/password login
 * - Password reset flow
 * - Email verification
 * - JWT token generation
 * - Session management
 *
 * Security:
 * - Passwords are hashed using bcrypt with salt rounds
 * - Tokens are generated with expiration
 * - Email verification tokens expire after 24 hours
 * - Password reset tokens expire after 1 hour
 */
@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
  private readonly PASSWORD_RESET_EXPIRY_HOURS = 1;
  private readonly REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Register a new user with email and password
   *
   * @param email - User email address
   * @param password - Plain text password (will be hashed)
   * @param name - Optional user name
   * @returns User object and access token
   */
  async register(email: string, password: string, name?: string) {
    console.log('[AuthService] register', {
      email,
      hasPassword: !!password,
      hasName: !!name,
    });

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate password strength
    if (!this.isValidPassword(password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one letter and one number',
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate email verification token
    const emailVerificationToken = this.generateToken();
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(
      emailVerificationExpires.getHours() +
        this.EMAIL_VERIFICATION_EXPIRY_HOURS,
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        emailVerificationToken,
        emailVerificationExpires,
        emailVerified: false,
      },
      include: {
        roles: true,
      },
    });

    // Generate JWT token
    const tokens = await this.issueTokens(user);

    console.log('[AuthService] register success', {
      userId: user.id,
      email: user.email,
    });

    // TODO: Send verification email
    // await this.sendVerificationEmail(user.email, emailVerificationToken);

    const exposeTokens = process.env.NODE_ENV !== 'production';

    return {
      user: this.mapUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      emailVerificationToken: exposeTokens ? emailVerificationToken : undefined,
    };
  }

  /**
   * Login with email and password
   *
   * @param email - User email address
   * @param password - Plain text password
   * @returns User object and access token
   */
  async login(email: string, password: string) {
    console.log('[AuthService] login', { email, hasPassword: !!password });

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!password) {
      throw new BadRequestException('Password is required');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Password not set. Please reset your password.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user);

    console.log('[AuthService] login success', {
      userId: user.id,
      email: user.email,
    });

    return {
      user: this.mapUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Validate user by email (for JWT strategy)
   *
   * @param email - User email address
   * @returns User object
   */
  async validateUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  /**
   * Request password reset
   *
   * Generates a password reset token and sends it via email.
   *
   * @param email - User email address
   * @returns Success message
   */
  async requestPasswordReset(email: string) {
    console.log('[AuthService] requestPasswordReset', { email });

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists (security best practice)
    if (!user) {
      console.warn(
        '[AuthService] Password reset requested for non-existent user',
        { email },
      );
      return {
        message: 'If an account exists, a password reset email has been sent',
      };
    }

    // Generate password reset token
    const passwordResetToken = this.generateToken();
    const passwordResetExpires = new Date();
    passwordResetExpires.setHours(
      passwordResetExpires.getHours() + this.PASSWORD_RESET_EXPIRY_HOURS,
    );

    // Save token to database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpires,
      },
    });

    console.log('[AuthService] Password reset token generated', {
      userId: user.id,
    });

    // TODO: Send password reset email
    // await this.sendPasswordResetEmail(user.email, passwordResetToken);

    return {
      message: 'If an account exists, a password reset email has been sent',
      resetToken:
        process.env.NODE_ENV !== 'production' ? passwordResetToken : undefined,
    };
  }

  /**
   * Reset password using reset token
   *
   * @param token - Password reset token
   * @param newPassword - New plain text password
   * @returns Success message
   */
  async resetPassword(token: string, newPassword: string) {
    console.log('[AuthService] resetPassword', { hasToken: !!token });

    // Validate password strength
    if (!this.isValidPassword(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one letter and one number',
      );
    }

    // Find user with valid reset token
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    console.log('[AuthService] Password reset success', { userId: user.id });

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Change password (for authenticated users)
   *
   * @param userId - User ID
   * @param currentPassword - Current plain text password
   * @param newPassword - New plain text password
   * @returns Success message
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    console.log('[AuthService] changePassword', { userId });

    // Validate password strength
    if (!this.isValidPassword(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one letter and one number',
      );
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    if (!user.password) {
      throw new BadRequestException(
        'Password not set. Please reset your password.',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    console.log('[AuthService] Password change success', { userId });

    return { message: 'Password has been changed successfully' };
  }

  /**
   * Verify email address using verification token
   *
   * @param token - Email verification token
   * @returns Success message
   */
  async verifyEmail(token: string) {
    console.log('[AuthService] verifyEmail', { hasToken: !!token });

    // Find user with valid verification token
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Invalid or expired email verification token',
      );
    }

    // Mark email as verified and clear token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    console.log('[AuthService] Email verification success', {
      userId: user.id,
    });

    return { message: 'Email has been verified successfully' };
  }

  /**
   * Resend email verification token
   *
   * @param email - User email address
   * @returns Success message
   */
  async resendVerificationEmail(email: string) {
    console.log('[AuthService] resendVerificationEmail', { email });

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const emailVerificationToken = this.generateToken();
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(
      emailVerificationExpires.getHours() +
        this.EMAIL_VERIFICATION_EXPIRY_HOURS,
    );

    // Update user
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    console.log('[AuthService] Verification email token regenerated', {
      userId: user.id,
    });

    // TODO: Send verification email
    // await this.sendVerificationEmail(user.email, emailVerificationToken);

    return {
      message: 'Verification email has been sent',
      verificationToken:
        process.env.NODE_ENV !== 'production'
          ? emailVerificationToken
          : undefined,
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    const hashed = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hashed },
      include: {
        user: {
          include: { roles: true },
        },
      },
    });

    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user);

    return {
      user: this.mapUser(stored.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Generate JWT access token
   *
   * @param userId - User ID
   * @param email - User email
   * @returns JWT token string
   */
  private async generateAccessToken(user: {
    id: number;
    email: string;
    roles?: { name: string }[];
  }): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email.toLowerCase(),
      roles: user.roles?.map((role) => role.name) ?? [],
    };
    return this.jwt.signAsync(payload);
  }

  /**
   * Generate a random token for email verification or password reset
   *
   * @returns Random token string
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async issueTokens(user: any) {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  private async issueRefreshToken(userId: number) {
    const token = randomBytes(48).toString('hex');
    const hashed = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: hashed,
        expiresAt,
      },
    });
    return token;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private mapUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      roles: user.roles.map((role: any) => ({
        ...role,
        description: role.description ?? undefined,
      })),
    };
  }

  /**
   * Validate email format
   *
   * @param email - Email address to validate
   * @returns True if valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   *
   * Requirements:
   * - At least 8 characters
   * - At least one letter
   * - At least one number
   *
   * @param password - Password to validate
   * @returns True if valid
   */
  private isValidPassword(password: string): boolean {
    if (password.length < 8) {
      return false;
    }
    if (!/[a-zA-Z]/.test(password)) {
      return false;
    }
    if (!/[0-9]/.test(password)) {
      return false;
    }
    return true;
  }
}
