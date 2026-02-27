import { Controller, Post, Body, UseGuards, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'User login' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'User registration' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('confirm-email/:token')
  @ApiOperation({ summary: 'Confirm user email' })
  async confirmEmail(@Param('token') token: string, @Res() res: Response) {
    try {
      await this.authService.confirmEmail(token);
      return res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>E-posta Doğrulandı</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
           min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 20px; padding: 48px 40px; max-width: 440px;
            width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { color: #1a1a2e; font-size: 26px; font-weight: 700; margin-bottom: 12px; }
    p { color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 16px; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32;
             padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 600;
             margin-bottom: 28px; }
    .note { font-size: 13px; color: #999; border-top: 1px solid #f0f0f0;
            padding-top: 20px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>E-posta Doğrulandı!</h1>
    <p>Harika! E-posta adresiniz başarıyla doğrulandı.</p>
    <div class="badge">✓ E-posta onaylandı</div>
    <p>Hesabınız şu an <strong>yönetici onayı</strong> bekleniyor. Onay tamamlandıktan sonra uygulamaya giriş yapabileceksiniz.</p>
    <div class="note">Bu sayfayı kapatabilirsiniz. Onay mailini bekleyin.</div>
  </div>
</body>
</html>`);
    } catch {
      return res.status(400).send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Doğrulama Hatası</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
           min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 20px; padding: 48px 40px; max-width: 440px;
            width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { color: #1a1a2e; font-size: 26px; font-weight: 700; margin-bottom: 12px; }
    p { color: #666; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Doğrulama Başarısız</h1>
    <p>Bu doğrulama linki geçersiz veya süresi dolmuş. Lütfen tekrar kayıt olmayı deneyin veya yöneticiyle iletişime geçin.</p>
  </div>
</body>
</html>`);
    }
  }

  @Post('refresh')
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout and revoke refresh tokens' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }
}
