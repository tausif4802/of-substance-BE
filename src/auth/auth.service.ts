import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entities/users.entity';
import { Role } from 'src/enums/role.enum';
import { UsersService } from 'src/users/users.service';
import { PasswordStrategy } from 'src/utils/password.strategy';
import { successHandler } from 'src/utils/response.handler';
import { Repository } from 'typeorm';
import { CredLoginDto, GoogleLoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private passwordStrategy: PasswordStrategy,
    private configService: ConfigService,
  ) {}

  async getTokens(userId: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.configService.get('ACCESS_TOKEN_SECRET'),
          expiresIn: this.configService.get('ACCESS_TOKEN_EXPIRATION_TIME'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.configService.get('REFRESH_TOKEN_SECRET'),
          expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRATION_TIME'),
        },
      ),
    ]);

    const tokens = {
      accessToken,
      refreshToken,
    };

    return tokens;
  }

  async signUp(signupUserDto: SignUpDto, userRole: Role = Role.User) {
    const user = await this.usersService.findUserByEmail(signupUserDto.email);
    if (user.length) {
      throw new BadRequestException('User with this email already exists');
    }

    let newUser;

    const encPassword = await this.passwordStrategy.hashPassword(
      signupUserDto.password,
    );

    newUser = this.userRepo.create({
      ...signupUserDto,
      password: encPassword,
      role: userRole,
    });

    await this.userRepo.save(newUser);

    delete newUser.password;

    const loginAttempt = await this.login({
      email: signupUserDto.email,
      password: signupUserDto.password,
    });

    return loginAttempt;
  }

  async login(loginInfo: CredLoginDto) {
    const [userInfo] = await this.usersService.findUserByEmail(loginInfo.email);

    if (!userInfo) {
      throw new NotFoundException('User with this email does not exist');
    }

    if (userInfo.status === 'inactive') {
      throw new BadRequestException('Account Restricted!');
    }

    const isPasswordValid = await bcrypt.compare(
      loginInfo.password,
      userInfo.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    const tokens = await this.getTokens(userInfo.id, userInfo.role);

    delete userInfo.password;

    return successHandler('Login successful', {
      ...tokens,
      user: userInfo,
    });
  }

  async refreshTokens(token: string) {
    try {
      const decodedJwtRefreshToken: any = this.jwtService.decode(token);

      if (!decodedJwtRefreshToken) {
        throw new ForbiddenException('Access Denied');
      }
      const expires = decodedJwtRefreshToken.exp;

      if (expires < new Date().getTime() / 1000) {
        throw new ForbiddenException('Access Denied');
      }

      const userInfo = await this.userRepo.findOneBy({
        id: decodedJwtRefreshToken.sub,
      });

      if (!userInfo) {
        throw new ForbiddenException('Access Denied');
      }

      const tokens = await this.getTokens(userInfo.id, userInfo.role);

      delete userInfo.password;

      return successHandler('Login successful', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: userInfo,
      });
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  async googleLogin(googleLoginDto: GoogleLoginDto) {
    let [userInfo] = await this.usersService.findUserByEmail(
      googleLoginDto.email,
    );

    if (!userInfo) {
      const newUser = this.userRepo.create({
        ...googleLoginDto,
        role: Role.User,
      });
      userInfo = await this.userRepo.save(newUser);
    }

    const tokens = await this.getTokens(userInfo.id, userInfo.role);

    delete userInfo.password;

    return successHandler('Login successful', {
      ...tokens,
      user: userInfo,
    });
  }
}
