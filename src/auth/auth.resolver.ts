import { Resolver, Mutation, Args, ObjectType, Field } from '@nestjs/graphql';
import { AuthService } from './auth.service';

@ObjectType()
class AuthPayload {
  @Field()
  accessToken: string;
}

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload, { name: 'login', description: 'MVP login by email only' })
  async login(@Args('email') email: string): Promise<AuthPayload> {
    const { accessToken } = await this.authService.login(email);
    return { accessToken };
  }
}
