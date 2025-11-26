import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

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
    console.log('[AuthService] register', { email, hasPassword: !!password, hasName: !!name });

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate password strength
    if (!this.isValidPassword(password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one letter and one number'
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
      emailVerificationExpires.getHours() + this.EMAIL_VERIFICATION_EXPIRY_HOURS
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
    const accessToken = await this.generateAccessToken(user.id, user.email);

    console.log('[AuthService] register success', { userId: user.id, email: user.email });

    // TODO: Send verification email
    // await this.sendVerificationEmail(user.email, emailVerificationToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        roles: user.roles.map(role => ({
          ...role,
          description: role.description ?? undefined,
        })),
      },
      accessToken,
      emailVerificationToken, // Return for testing, remove in production
    };
  }

  /**
   * Login with email and password
   * 
   * @param email - User email address
   * @param password - Plain text password
   * @returns User object and access token
   */
  async login(email: string, password?: string) {
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

    // If password is provided, verify it
    if (password) {
      if (!user.password) {
        throw new UnauthorizedException('Password not set. Please reset your password.');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
    } else {
      // Backward compatibility: allow login without password for existing users
      // This should be removed in production after migration
      console.warn('[AuthService] Login without password (backward compatibility mode)', { email });
    }

    // Update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const accessToken = await this.generateAccessToken(user.id, user.email);

    console.log('[AuthService] login success', { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        roles: user.roles.map(role => ({
          ...role,
          description: role.description ?? undefined,
        })),
      },
      accessToken,
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
      console.warn('[AuthService] Password reset requested for non-existent user', { email });
      return { message: 'If an account exists, a password reset email has been sent' };
    }

    // Generate password reset token
    const passwordResetToken = this.generateToken();
    const passwordResetExpires = new Date();
    passwordResetExpires.setHours(
      passwordResetExpires.getHours() + this.PASSWORD_RESET_EXPIRY_HOURS
    );

    // Save token to database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpires,
      },
    });

    console.log('[AuthService] Password reset token generated', { userId: user.id });

    // TODO: Send password reset email
    // await this.sendPasswordResetEmail(user.email, passwordResetToken);

    return {
      message: 'If an account exists, a password reset email has been sent',
      resetToken: passwordResetToken, // Return for testing, remove in production
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
        'Password must be at least 8 characters long and contain at least one letter and one number'
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
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    console.log('[AuthService] changePassword', { userId });

    // Validate password strength
    if (!this.isValidPassword(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain at least one letter and one number'
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
      throw new BadRequestException('Password not set. Please reset your password.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
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
      throw new BadRequestException('Invalid or expired email verification token');
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

    console.log('[AuthService] Email verification success', { userId: user.id });

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
      emailVerificationExpires.getHours() + this.EMAIL_VERIFICATION_EXPIRY_HOURS
    );

    // Update user
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    console.log('[AuthService] Verification email token regenerated', { userId: user.id });

    // TODO: Send verification email
    // await this.sendVerificationEmail(user.email, emailVerificationToken);

    return {
      message: 'Verification email has been sent',
      verificationToken: emailVerificationToken, // Return for testing, remove in production
    };
  }

  /**
   * Generate JWT access token
   * 
   * @param userId - User ID
   * @param email - User email
   * @returns JWT token string
   */
  private async generateAccessToken(userId: number, email: string): Promise<string> {
    const payload = {
      sub: userId,
      email: email.toLowerCase(),
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
