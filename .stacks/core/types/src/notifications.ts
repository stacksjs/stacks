import type { IChatOptions, IEmailOptions, ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless'

export interface NotificationOptions {
  driver?: string;

  novu: {
    key: string;
  };

  email: {
    sendgrid: {
      key: string;
      from: string;
      senderName: string;
    };

    emailjs: {
      from: string;
      host: string;
      user: string;
      password: string;
      port: number;
      secure: boolean;
    };
  
    mailgun: {
      key: string;
      domain: string;
      username: string;
      from: string;
    };
  
    mailjet: {
      key: string;
      secret: string;
      from: string;
    };
  
    mandrill: {
      key: string;
      from: string;
    };
  
    netcore: {
      key: string;
      from: string;
    };
  
    nodemailer: {
      from: string;
      host: string;
      user: string;
      password: string;
      port: number;
      secure: boolean;
    };
  
    postmark: {
      key: string;
      from: string;
    };
  
    ses: {
      region: string;
      key: string;
      secret: string;
      from: string;
    };
  };

  sms: {
    twilio: {
      sid: string;
      authToken: string;
      from: string;
      to: string;
    };

    nexmo: {
      key: string;
      secret: string;
      from: string;
    };

    gupshup: {
      user: string;
      password: string;
    };

    plivo: {
      sid: string;
      authToken: string;
      from: string;
    };

    sms77: {
      key: string;
      from: string;
    };

    sns: {
      region: string;
      key: string;
      secret: string;
    };

    telnyx: {
      key: string;
      messageProfileId: string;
      from: string;
    };

    termii: {
      key: string;
      from: string;
    };
  };

  chat: {
    slack: {
      appId: string;
      clientID: string;
      secret: string;
    };
  };
}

export type EmailOptions = IEmailOptions

export type SendMessageSuccessResponse = ISendMessageSuccessResponse

export type ChatOptions = IChatOptions

export type SmsOptions = ISmsOptions
export interface FCMPushNotificationOptions {
    eventName: string;
    to: {
      subscriberId: string;
    };
      payload: {
        deviceTokens: Array<string>;
        badge: boolean;
        clickAction: string;
        color: string;
        icon: string;
        sound: string;
    };
}

export interface ExpoPushNotificationOptions {
  eventName: string;
  to: {
    subscriberId: string;
  };
  payload: {
    to: string[];
    data: Object;
    title: string;
    body: string;
    ttl: number;
    expiration: number;
    priority: 'default' | 'normal' | 'high';
    subtitle: string;
    sound: 'default' | null;
    badge: number;
    channelId: string;
    categoryId: string;
    mutableContent: boolean;
  };
}