import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Current User Decorator
 * 
 * Extracts the current authenticated user from the request context.
 * Works with both REST and GraphQL contexts.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const request = gqlCtx.getContext().req;
    return request.user;
  },
);
