import 'dotenv/config';
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmailData {
  name: string;
  resetUrl: string;
  database: string;
  expiresIn: string;
}

interface UserCreatedEmailData {
  name: string;
  email: string;
  activationUrl: string;
  roleName: string;
  database: string;
  createdBy: string;
  expiresIn: string;
}

interface ActionNotificationEmailData {
  adminName: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityName: string;
  database: string;
  date: Date;
}

interface AlertEmailData {
  recipientName: string;
  database: string;
  alertKind: 'hearing_upcoming' | 'payment_overdue';
  subject: string;
  heading: string;
  /** Rows of plain "Label: Value" text rendered as <li>. */
  lines: string[];
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Crea el transporter en el primer uso, no en el import del módulo.
   * Validar SMTP_* aquí mantiene `next build` y los entornos sin correo
   * funcionando: una credencial ausente solo falla la ruta de email,
   * en runtime, en lugar de tumbar todo el build/arranque.
   */
  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    if (!user || !pass) {
      throw new Error(
        'SMTP_USER y SMTP_PASSWORD son requeridos para enviar correos',
      );
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
    return this.transporter;
  }

  private async sendEmail({
    to,
    subject,
    html,
    text,
  }: EmailOptions): Promise<boolean> {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        if (process.env.NODE_ENV === 'production') {
          // En producción la falta de SMTP es un error operativo, no
          // un caso de simulación: se reporta y el envío falla explícito.
          console.error(
            '❌ SMTP no configurado (SMTP_USER/SMTP_PASSWORD): no se pudo enviar el correo a:',
            to,
          );
          return false;
        }
        console.log('\n📧 ===== EMAIL SIMULATION MODE =====');
        console.log('⚠️  SMTP not configured - Simulating email send');
        console.log('📤 To:', to);
        console.log('📋 Subject:', subject);
        console.log(
          '📄 Content Preview:',
          text?.substring(0, 200) + '...' || 'HTML content',
        );
        console.log(
          '💡 To enable real email sending, configure SMTP_USER and SMTP_PASSWORD in your .env file',
        );
        console.log(
          '🔗 For Gmail: Use App Password from https://support.google.com/accounts/answer/185833',
        );
        console.log('=======================================\n');
        return true;
      }

      const info = await this.getTransporter().sendMail({
        from: {
          name: 'Sistema Insolventic',
          address: process.env.SMTP_USER!,
        },
        to,
        subject,
        text,
        html,
      });

      console.log('✅ Email sent successfully to:', to);
      console.log('📧 Message ID:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error sending email to:', to);
      console.error('💥 Error details:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(
    to: string,
    data: PasswordResetEmailData,
  ): Promise<boolean> {
    const { name, resetUrl, database, expiresIn } = data;

    const databaseDisplayNames = {
      armonia: 'Armonia',
      'constructores-paz': 'Constructores de Paz',
    };

    const databaseName =
      databaseDisplayNames[database as keyof typeof databaseDisplayNames] ||
      database;

    const subject = `Restablecer contraseña - Sistema Insolventic (${databaseName})`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Restablecer Contraseña</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #3b82f6;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 10px;
        }
        .database-badge {
          background: ${database === 'armonia' ? '#ea580c' : '#3b82f6'};
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 12px;
          display: inline-block;
        }
        .content {
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          background: #3b82f6;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
          text-align: center;
        }
        .button:hover {
          background: #2563eb;
        }
        .warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏛️ INSOLVENTIC</div>
          <span class="database-badge">${databaseName}</span>
          <p style="margin: 10px 0 0 0; color: #6b7280;">Sistema de Gestión de Procesos de Insolvencia</p>
        </div>

        <div class="content">
          <h2 style="color: #1f2937;">Hola ${name},</h2>
          
          <p>Has solicitado restablecer tu contraseña para acceder al sistema <strong>${databaseName}</strong>.</p>
          
          <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
          </div>
          
          <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 5px; font-family: monospace;">
            ${resetUrl}
          </p>

          <div class="warning">
            <strong>⚠️ Importante:</strong>
            <ul>
              <li>Este enlace expira en <strong>${expiresIn}</strong></li>
              <li>Solo puede ser usado una vez</li>
              <li>Si no solicitaste este cambio, ignora este correo</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Este es un correo automático, no respondas a esta dirección.</p>
          <p>Si tienes problemas, contacta al administrador del sistema.</p>
          <p>© ${new Date().getFullYear()} Sistema Insolventic - ${databaseName}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const text = `
    Hola ${name},

    Has solicitado restablecer tu contraseña para el sistema ${databaseName}.

    Para crear una nueva contraseña, visita este enlace:
    ${resetUrl}

    Este enlace expira en ${expiresIn} y solo puede ser usado una vez.

    Si no solicitaste este cambio, ignora este correo.

    --
    Sistema Insolventic - ${databaseName}
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: text.trim(),
    });
  }

  async sendUserCreatedEmail(
    to: string,
    data: UserCreatedEmailData,
  ): Promise<boolean> {
    const {
      name,
      email,
      activationUrl,
      roleName,
      database,
      createdBy,
      expiresIn,
    } = data;

    const databaseDisplayNames = {
      armonia: 'Armonia',
      'constructores-paz': 'Constructores de Paz',
    };

    const databaseName =
      databaseDisplayNames[database as keyof typeof databaseDisplayNames] ||
      database;

    const subject = `Cuenta creada en Sistema Insolventic - ${databaseName}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cuenta Creada</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #3b82f6;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 10px;
        }
        .database-badge {
          background: ${database === 'armonia' ? '#ea580c' : '#3b82f6'};
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 12px;
          display: inline-block;
        }
        .credentials-box {
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .password {
          font-family: monospace;
          font-size: 18px;
          font-weight: bold;
          color: #1e40af;
          background: white;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #d1d5db;
          margin: 10px 0;
          letter-spacing: 1px;
        }
        .button {
          display: inline-block;
          background: #3b82f6;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
        }
        .warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏛️ INSOLVENTIC</div>
          <span class="database-badge">${databaseName}</span>
          <p style="margin: 10px 0 0 0; color: #6b7280;">Sistema de Gestión de Procesos de Insolvencia</p>
        </div>

        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937;">Hola ${name},</h2>
          
          <p>Tu cuenta ha sido creada en el sistema <strong>${databaseName}</strong> por <strong>${createdBy}</strong>.</p>
          
          <div class="credentials-box">
            <h3 style="margin-top: 0; color: #374151;">📋 Información de tu cuenta</h3>
            <p><strong>Usuario:</strong> ${email}</p>
            <p><strong>Rol:</strong> ${roleName}</p>
          </div>

          <p>Para activar tu cuenta, haz clic en el siguiente botón y establece tu contraseña:</p>

          <div style="text-align: center;">
            <a href="${activationUrl}" class="button">Activar mi Cuenta</a>
          </div>

          <div class="warning">
            <strong>🔐 Importante - Seguridad:</strong>
            <ul>
              <li>Este enlace de activación expira en <strong>${expiresIn}</strong></li>
              <li>Si no solicitaste esta cuenta, ignora este correo</li>
              <li>No compartas este enlace con nadie</li>
            </ul>
          </div>

          <p><strong>Pasos siguientes:</strong></p>
          <ol>
            <li>Haz clic en "Activar mi Cuenta" arriba</li>
            <li>Establece una contraseña segura</li>
            <li>Inicia sesión con tu nueva contraseña</li>
            <li>Explora las funcionalidades disponibles para tu rol</li>
          </ol>
        </div>

        <div class="footer">
          <p>Este correo contiene información sensible. Manténlo seguro.</p>
          <p>© ${new Date().getFullYear()} Sistema Insolventic - ${databaseName}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const text = `
    Hola ${name},

    Tu cuenta ha sido creada en el sistema ${databaseName} por ${createdBy}.

    INFORMACIÓN DE TU CUENTA:
    - Usuario: ${email}
    - Rol: ${roleName}

    Para activar tu cuenta y establecer tu contraseña, visita:
    ${activationUrl}

    IMPORTANTE - SEGURIDAD:
    - Este enlace de activación expira en ${expiresIn}
    - Si no solicitaste esta cuenta, ignora este correo
    - No compartas este enlace con nadie

    PASOS SIGUIENTES:
    1. Abre el enlace de activación
    2. Establece una contraseña segura
    3. Inicia sesión y explora las funcionalidades

    --
    Sistema Insolventic - ${databaseName}
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: text.trim(),
    });
  }

  async sendWelcomeEmail(
    to: string,
    name: string,
    database: string,
  ): Promise<boolean> {
    const databaseDisplayNames = {
      armonia: 'Armonia',
      'constructores-paz': 'Constructores de Paz',
    };

    const databaseName =
      databaseDisplayNames[database as keyof typeof databaseDisplayNames] ||
      database;
    const loginUrl = `${process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login?db=${database}`;

    const subject = `Bienvenido a Sistema Insolventic - ${databaseName}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido al Sistema</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #3b82f6;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 10px;
        }
        .database-badge {
          background: ${database === 'armonia' ? '#ea580c' : '#3b82f6'};
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 12px;
          display: inline-block;
        }
        .button {
          display: inline-block;
          background: #10b981;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏛️ INSOLVENTIC</div>
          <span class="database-badge">${databaseName}</span>
          <p style="margin: 10px 0 0 0; color: #6b7280;">Sistema de Gestión de Procesos de Insolvencia</p>
        </div>

        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937;">¡Bienvenido ${name}! 🎉</h2>
          
          <p>Tu cuenta ha sido creada exitosamente en el sistema <strong>${databaseName}</strong>.</p>
          
          <p>Ya puedes acceder al sistema y comenzar a gestionar procesos de insolvencia:</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Iniciar Sesión</a>
          </div>
          
          <p><strong>Información de tu cuenta:</strong></p>
          <ul>
            <li><strong>Email:</strong> ${to}</li>
            <li><strong>Sistema:</strong> ${databaseName}</li>
            <li><strong>Rol:</strong> Usuario</li>
          </ul>
          
          <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactar al administrador del sistema.</p>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Sistema Insolventic - ${databaseName}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const text = `
    ¡Bienvenido ${name}!

    Tu cuenta ha sido creada exitosamente en el sistema ${databaseName}.

    Información de tu cuenta:
    - Email: ${to}
    - Sistema: ${databaseName} 
    - Rol: Usuario

    Puedes iniciar sesión en: ${loginUrl}

    --
    Sistema Insolventic - ${databaseName}
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: text.trim(),
    });
  }

  async sendActionNotificationEmail(
    to: string,
    data: ActionNotificationEmailData,
  ): Promise<boolean> {
    const {
      adminName,
      actorName,
      actorEmail,
      actorRole,
      action,
      entity,
      entityName,
      database,
      date,
    } = data;

    const databaseDisplayNames = {
      armonia: 'Armonia',
      'constructores-paz': 'Constructores de Paz',
    };

    const databaseName =
      databaseDisplayNames[database as keyof typeof databaseDisplayNames] ||
      database;

    const entityCapitalized = entity.charAt(0).toUpperCase() + entity.slice(1);
    const formattedDate =
      date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' ' +
      date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

    const subject = `Notificación de Acción: ${entityCapitalized} ${action} - Sistema Insolventic (${databaseName})`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificación de Acción en el Sistema</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #3b82f6;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 10px;
        }
        .database-badge {
          background: ${database === 'armonia' ? '#ea580c' : '#3b82f6'};
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 12px;
          display: inline-block;
        }
        .info-box {
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .info-row {
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: bold;
          color: #374151;
        }
        .info-value {
          color: #1f2937;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏛️ INSOLVENTIC</div>
          <span class="database-badge">${databaseName}</span>
          <p style="margin: 10px 0 0 0; color: #6b7280;">Sistema de Gestión de Procesos de Insolvencia</p>
        </div>

        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937;">Notificación de Acción en el Sistema</h2>

          <p>Hola ${adminName},</p>
          <p>Se ha registrado la siguiente acción en el sistema <strong>${databaseName}</strong>:</p>

          <div class="info-box">
            <div class="info-row">
              <span class="info-label">Acción:</span>
              <span class="info-value">${entityCapitalized} ${action}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Elemento:</span>
              <span class="info-value">${entityName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Realizada por:</span>
              <span class="info-value">${actorName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email del actor:</span>
              <span class="info-value">${actorEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Rol:</span>
              <span class="info-value">${actorRole}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Fecha y hora:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Organización:</span>
              <span class="info-value">${databaseName}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Este es un correo automático de notificación de acciones del sistema.</p>
          <p>No es necesario responder a este correo.</p>
          <p>© ${new Date().getFullYear()} Sistema Insolventic - ${databaseName}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const text = `
    Notificación de Acción en el Sistema

    Hola ${adminName},

    Se ha registrado la siguiente acción en el sistema ${databaseName}:

    DETALLE DE LA ACCIÓN:
    - Acción: ${entityCapitalized} ${action}
    - Elemento: ${entityName}
    - Realizada por: ${actorName}
    - Email del actor: ${actorEmail}
    - Rol: ${actorRole}
    - Fecha y hora: ${formattedDate}
    - Organización: ${databaseName}

    --
    Sistema Insolventic - ${databaseName}
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: text.trim(),
    });
  }

  /**
   * Plantilla genérica para alertas proactivas (audiencias, pagos).
   * Se mantiene deliberadamente simple: encabezado + lista de datos clave.
   */
  async sendAlertEmail(to: string, data: AlertEmailData): Promise<boolean> {
    const { recipientName, database, alertKind, subject, heading, lines } =
      data;

    const databaseDisplayNames = {
      armonia: 'Armonia',
      'constructores-paz': 'Constructores de Paz',
    };
    const databaseName =
      databaseDisplayNames[database as keyof typeof databaseDisplayNames] ||
      database;

    const accent = alertKind === 'payment_overdue' ? '#dc2626' : '#d97706';

    const rows = lines
      .map(
        (l) =>
          `<li style="padding: 6px 0; border-bottom: 1px solid #e5e7eb;">${l}</li>`,
      )
      .join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; padding: 30px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid ${accent};">
          <div style="font-size: 28px; font-weight: bold; color: ${accent};">🏛️ INSOLVENTIC</div>
          <p style="margin: 10px 0 0 0; color: #6b7280;">${databaseName}</p>
        </div>
        <h2 style="color: ${accent};">${heading}</h2>
        <p>Hola ${recipientName},</p>
        <p>Se ha detectado el siguiente evento que requiere tu atención:</p>
        <ul style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; list-style: none;">
          ${rows}
        </ul>
        <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
          Este correo se generó automáticamente por el sistema de alertas. Si
          crees que es un error, revisa el caso en la plataforma.
        </p>
      </div>
    </body>
    </html>
    `;

    const text = `${heading}\n\nHola ${recipientName},\n\nSe ha detectado el siguiente evento:\n\n${lines.join('\n')}\n\n--\nSistema Insolventic - ${databaseName}`;

    return this.sendEmail({ to, subject, html, text });
  }

  // Verificar configuración SMTP
  async verifyConnection(): Promise<boolean> {
    try {
      if (!process.env.SMTP_PASSWORD) {
        console.log('\n🔧 ===== EMAIL CONFIGURATION STATUS =====');
        console.log('⚠️  SMTP not configured - emails will be simulated');
        console.log('📧 SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
        console.log(
          '🔐 SMTP_PASSWORD:',
          process.env.SMTP_PASSWORD ? 'SET' : 'NOT SET',
        );
        console.log('💡 To enable real email sending:');
        console.log('   1. Set SMTP_USER in your .env file');
        console.log('   2. Set SMTP_PASSWORD in your .env file');
        console.log('   3. For Gmail, use App Password');
        console.log('======================================\n');
        return true;
      }

      await this.getTransporter().verify();
      console.log('✅ SMTP connection verified successfully');
      console.log('📧 SMTP_USER:', process.env.SMTP_USER);
      console.log('🔐 SMTP_PASSWORD: SET (hidden for security)');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      console.error('💡 Check your SMTP credentials and network connection');
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
