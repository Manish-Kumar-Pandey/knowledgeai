/**
 * Utility to detect and block disposable, temporary, and public mailbox email domains.
 */

export const DEMO_ADMIN_EMAIL = 'admin.kai@yopmail.com';

// Common disposable, temporary, and publicly accessible mailbox domains
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'mailinator.com',
  'mailin8r.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'sharklasers.com',
  'grr.la',
  'pokemail.net',
  'spam4.me',
  'dispostable.com',
  'throwawaymail.com',
  'getairmail.com',
  'mohmal.com',
  'mytemp.email',
  'crazymailing.com',
  'fakemailgenerator.com',
  'nada.ltd',
  'inboxkitten.com',
  'burnermail.io',
  'generator.email',
  'emailondeck.com',
]);

export class DisposableEmailValidator {
  /**
   * Extracts the domain from an email address
   */
  static getDomain(email: string): string {
    const parts = email.trim().toLowerCase().split('@');
    return parts.length === 2 ? parts[1] : '';
  }

  /**
   * Checks if an email uses a disposable / temporary domain
   */
  static isDisposable(email: string): boolean {
    const domain = this.getDomain(email);
    if (!domain) return false;
    return DISPOSABLE_EMAIL_DOMAINS.has(domain);
  }

  /**
   * Checks if the email is the protected demo admin account
   */
  static isDemoAccount(email: string): boolean {
    return email.trim().toLowerCase() === DEMO_ADMIN_EMAIL;
  }
}
