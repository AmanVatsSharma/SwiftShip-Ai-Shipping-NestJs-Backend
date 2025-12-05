import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthPayload, MessageResponse } from './auth.model';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from './gql-auth.guard';

/**
 * Auth Resolver
 *
 * Provides authentication and authorization mutations.
 *
 * Features:
 * - User registration with password
 * - Email/password login
 * - Password reset flow
 * - Email verification
 * - Password change
 *
 * Security:
 * - Passwords are validated for strength
 * - Tokens expire after configured time
 * - Email verification required for full access
 */
@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user with email and password
   *
   * Creates a new user account, hashes the password, and generates an email verification token.
   * Returns access token and user information.
   */
  @Mutation(() => AuthPayload, {
    description: 'Register a new user with email and password',
  })
  async register(
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('name', { nullable: true }) name?: string,
  ): Promise<AuthPayload> {
    console.log('[AuthResolver] register', {
      email,
      hasPassword: !!password,
      hasName: !!name,
    });
    return this.authService.register(email, password, name);
  }

  /**
   * Login with email and password
   *
   * Authenticates user and returns JWT access token.
   * Supports backward compatibility: can login with email only for existing users without passwords.
   */
  @Mutation(() => AuthPayload, {
    description:
      'Login with email and password (password optional for backward compatibility)',
  })
  async login(
    @Args('email') email: string,
    @Args('password', { nullable: true }) password?: string,
  ): Promise<AuthPayload> {
    console.log('[AuthResolver] login', { email, hasPassword: !!password });
    return this.authService.login(email, password ?? '');
  }

  /**
   * Request password reset
   *
   * Generates a password reset token and sends it via email.
   * Returns success message (doesn't reveal if user exists for security).
   */
  @Mutation(() => MessageResponse, {
    description: 'Request password reset email',
  })
  async requestPasswordReset(
    @Args('email') email: string,
  ): Promise<MessageResponse> {
    console.log('[AuthResolver] requestPasswordReset', { email });
    return this.authService.requestPasswordReset(email);
  }

  /**
   * Reset password using reset token
   *
   * Resets user password using a valid password reset token.
   * Token must be valid and not expired.
   */
  @Mutation(() => MessageResponse, {
    description: 'Reset password using reset token',
  })
  async resetPassword(
    @Args('token') token: string,
    @Args('newPassword') newPassword: string,
  ): Promise<MessageResponse> {
    console.log('[AuthResolver] resetPassword', { hasToken: !!token });
    return this.authService.resetPassword(token, newPassword);
  }

  /**
   * Change password (for authenticated users)
   *
   * Changes password for authenticated user.
   * Requires current password verification.
   */
  @Mutation(() => MessageResponse, {
    description: 'Change password (requires authentication)',
  })
  @UseGuards(GqlAuthGuard)
  async changePassword(
    @Context() context: any,
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
  ): Promise<MessageResponse> {
    const userId =
      context.req.user?.userId ?? context.req.user?.sub ?? context.req.user?.id;
    console.log('[AuthResolver] changePassword', { userId });
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.authService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );
  }

  /**
   * Verify email address using verification token
   *
   * Verifies user email address using a valid verification token.
   * Token must be valid and not expired.
   */
  @Mutation(() => MessageResponse, {
    description: 'Verify email address using verification token',
  })
  async verifyEmail(@Args('token') token: string): Promise<MessageResponse> {
    console.log('[AuthResolver] verifyEmail', { hasToken: !!token });
    return this.authService.verifyEmail(token);
  }

  /**
   * Resend email verification token
   *
   * Generates a new verification token and sends it via email.
   * Useful if the original token expired.
   */
  @Mutation(() => MessageResponse, {
    description: 'Resend email verification token',
  })
  async resendVerificationEmail(
    @Args('email') email: string,
  ): Promise<MessageResponse> {
    console.log('[AuthResolver] resendVerificationEmail', { email });
    return this.authService.resendVerificationEmail(email);
  }

  /**
   * Refresh access token using a valid refresh token
   */
  @Mutation(() => AuthPayload, {
    description: 'Refresh access and refresh tokens',
  })
  async refreshTokens(
    @Args('refreshToken') refreshToken: string,
  ): Promise<AuthPayload> {
    console.log('[AuthResolver] refreshTokens');
    return this.authService.refreshTokens(refreshToken);
  }
}
