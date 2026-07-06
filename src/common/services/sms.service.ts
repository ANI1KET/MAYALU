import { Injectable, Logger } from '@nestjs/common';
import { getConfig } from '../../config/app.config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    const config = getConfig();
    const message = `Your Mayalu Wears OTP is: ${otp}. Valid for 5 minutes. Do not share with anyone.`;

    if (config.SMS_PROVIDER === 'mock' || config.SMS_DEBUG) {
      this.logger.debug(`[MOCK SMS] → ${phone}: ${message}`);
      return;
    }

    await this.sendViaSparrow(
      phone,
      message,
      config.SPARROW_SMS_TOKEN ?? '',
      config.SPARROW_SMS_FROM ?? 'MayaluWears',
    );
  }

  async sendOrderConfirmation(phone: string, orderNumber: string): Promise<void> {
    const config = getConfig();
    const message = `Your Mayalu Wears order ${orderNumber} has been placed successfully! Thank you for shopping with us.`;

    if (config.SMS_PROVIDER === 'mock' || config.SMS_DEBUG) {
      this.logger.debug(`[MOCK SMS] → ${phone}: ${message}`);
      return;
    }

    await this.sendViaSparrow(
      phone,
      message,
      config.SPARROW_SMS_TOKEN ?? '',
      config.SPARROW_SMS_FROM ?? 'MayaluWears',
    );
  }

  async sendShippingUpdate(phone: string, orderNumber: string): Promise<void> {
    const config = getConfig();
    const message = `Your Mayalu Wears order ${orderNumber} has been shipped and is on its way to you!`;

    if (config.SMS_PROVIDER === 'mock' || config.SMS_DEBUG) {
      this.logger.debug(`[MOCK SMS] → ${phone}: ${message}`);
      return;
    }

    await this.sendViaSparrow(
      phone,
      message,
      config.SPARROW_SMS_TOKEN ?? '',
      config.SPARROW_SMS_FROM ?? 'MayaluWears',
    );
  }

  private async sendViaSparrow(
    phone: string,
    message: string,
    token: string,
    from: string,
  ): Promise<void> {
    const url = 'https://api.sparrowsms.com/v2/sms/';
    const body = new URLSearchParams({ token, from, to: phone, text: message });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Sparrow SMS failed for ${phone}: ${res.status} ${text}`);
      } else {
        this.logger.log(`SMS sent to ${phone}`);
      }
    } catch (err) {
      this.logger.error(`Sparrow SMS network error for ${phone}: ${String(err)}`);
    }
  }
}
