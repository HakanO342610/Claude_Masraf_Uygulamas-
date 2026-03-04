import { IIdentityAdapter, IIdentityEmployee } from './identity-adapter.interface';

/** Standalone mod — harici IDP yok, kullanıcılar manuel yönetilir */
export class NullAdapter implements IIdentityAdapter {
  async syncUsers(): Promise<IIdentityEmployee[]> {
    return [];
  }

  async testConnection() {
    return { connected: true, systemInfo: 'Standalone mode — no identity provider configured' };
  }
}
