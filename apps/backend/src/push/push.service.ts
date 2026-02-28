import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: any = null;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
      return;
    }

    try {
      // Lazy-load firebase-admin only when credentials are present
      const admin = await import('firebase-admin');
      const serviceAccount = JSON.parse(serviceAccountJson);
      this.app = admin.default.initializeApp({
        credential: admin.default.credential.cert(serviceAccount),
      });
      this.logger.log('Firebase Admin initialized');
    } catch (err: any) {
      this.logger.error('Firebase init failed: ' + err.message);
    }
  }

  async sendToToken(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
    if (!this.app) return;
    try {
      const admin = await import('firebase-admin');
      await admin.default.messaging(this.app).send({
        token: fcmToken,
        notification: { title, body },
        data,
      });
    } catch (err: any) {
      this.logger.warn(`Push failed for token ${fcmToken.slice(0, 10)}...: ${err.message}`);
    }
  }

  async sendToTokens(fcmTokens: string[], title: string, body: string, data?: Record<string, string>) {
    await Promise.all(fcmTokens.map((t) => this.sendToToken(t, title, body, data)));
  }
}
