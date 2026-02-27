import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.config.get<string>('MAIL_USER'),
        pass: this.config.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendEmailConfirmation(toEmail: string, token: string): Promise<void> {
    const appBaseUrl = this.config.get<string>('APP_BASE_URL', 'http://localhost:3001');
    const confirmUrl = `${appBaseUrl}/api/v1/auth/confirm-email/${token}`;

    const mailOptions = {
      from: `"Expense Management" <${this.config.get<string>('MAIL_USER')}>`,
      to: toEmail,
      subject: 'Email Doğrulama - Expense Management',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #3949AB;">Hoş Geldiniz!</h2>
          <p>Expense Management uygulamasına kayıt olduğunuz için teşekkürler.</p>
          <p>Hesabınızı aktive etmek için aşağıdaki butona tıklayın:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${confirmUrl}"
               style="background-color: #3949AB; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 8px; font-size: 16px;">
              E-postamı Doğrula
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">
            Buton çalışmıyorsa aşağıdaki linki tarayıcınıza kopyalayın:<br/>
            <a href="${confirmUrl}">${confirmUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px;">
            E-postanız doğrulandıktan sonra hesabınız Admin tarafından onaylanmasını bekleyecektir.
            Bu işlemi siz yapmadıysanız bu maili görmezden gelebilirsiniz.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Confirmation email sent to ${toEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send confirmation email to ${toEmail}: ${error}`);
      throw error;
    }
  }
}
