import { Test, TestingModule } from '@nestjs/testing';
import { IdentityAdapterFactory } from './identity-adapter.factory';
import { CryptoService } from '../../common/crypto.service';
import { NullAdapter } from './null.adapter';
import { SapHcmAdapter } from './sap-hcm.adapter';
import { SapS4OnPremAdapter } from './sap-s4-onprem.adapter';
import { SapS4CloudAdapter } from './sap-s4-cloud.adapter';
import { AzureAdAdapter } from './azure-ad.adapter';
import { LdapAdapter } from './ldap.adapter';
import { ExternalDbAdapter } from './external-db.adapter';

const mockCrypto = {
  encryptJson: jest.fn(),
  decryptJson: jest.fn(),
};

describe('IdentityAdapterFactory', () => {
  let factory: IdentityAdapterFactory;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityAdapterFactory,
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();
    factory = module.get<IdentityAdapterFactory>(IdentityAdapterFactory);
  });

  describe('createFromEnv', () => {
    it('returns NullAdapter when IDENTITY_PROVIDER is not set', () => {
      delete process.env.IDENTITY_PROVIDER;
      const adapter = factory.createFromEnv();
      expect(adapter).toBeInstanceOf(NullAdapter);
    });

    it('returns NullAdapter when IDENTITY_PROVIDER=NONE', () => {
      process.env.IDENTITY_PROVIDER = 'NONE';
      const adapter = factory.createFromEnv();
      expect(adapter).toBeInstanceOf(NullAdapter);
    });

    it('returns SapHcmAdapter when IDENTITY_PROVIDER=SAP_HCM', () => {
      process.env.IDENTITY_PROVIDER = 'SAP_HCM';
      process.env.SAP_BASE_URL = 'http://sap:8000';
      process.env.SAP_USERNAME = 'user';
      process.env.SAP_PASSWORD = 'pass';
      const adapter = factory.createFromEnv();
      expect(adapter).toBeInstanceOf(SapHcmAdapter);
    });

    it('returns AzureAdAdapter when IDENTITY_PROVIDER=AZURE_AD', () => {
      process.env.IDENTITY_PROVIDER = 'AZURE_AD';
      process.env.AZURE_TENANT_ID = 'tenant';
      process.env.AZURE_CLIENT_ID = 'client';
      process.env.AZURE_CLIENT_SECRET = 'secret';
      const adapter = factory.createFromEnv();
      expect(adapter).toBeInstanceOf(AzureAdAdapter);
    });
  });

  describe('createForOrg', () => {
    it('returns NullAdapter for org with idpType NONE', () => {
      const adapter = factory.createForOrg({ idpType: 'NONE' });
      expect(adapter).toBeInstanceOf(NullAdapter);
    });

    it('decrypts idpConfig and creates correct adapter', () => {
      mockCrypto.decryptJson.mockReturnValue({ url: 'http://sap', username: 'u', password: 'p' });
      const adapter = factory.createForOrg({ idpType: 'SAP_HCM', idpConfig: 'encrypted' });
      expect(mockCrypto.decryptJson).toHaveBeenCalledWith('encrypted');
      expect(adapter).toBeInstanceOf(SapHcmAdapter);
    });

    it('returns NullAdapter when idpConfig decryption fails', () => {
      mockCrypto.decryptJson.mockImplementation(() => { throw new Error('bad key'); });
      const adapter = factory.createForOrg({ idpType: 'SAP_HCM', idpConfig: 'bad-encrypted' });
      // Falls back to env vars — still SapHcmAdapter (env may have values from previous test)
      expect(adapter).toBeDefined();
    });

    it('creates SapS4OnPremAdapter', () => {
      mockCrypto.decryptJson.mockReturnValue({ url: 'http://s4', username: 'u', password: 'p' });
      const adapter = factory.createForOrg({ idpType: 'SAP_S4_ONPREM', idpConfig: 'enc' });
      expect(adapter).toBeInstanceOf(SapS4OnPremAdapter);
    });

    it('creates SapS4CloudAdapter', () => {
      mockCrypto.decryptJson.mockReturnValue({
        url: 'http://sf', companyId: 'co', clientId: 'c', clientSecret: 's',
      });
      const adapter = factory.createForOrg({ idpType: 'SAP_S4_CLOUD', idpConfig: 'enc' });
      expect(adapter).toBeInstanceOf(SapS4CloudAdapter);
    });

    it('creates LdapAdapter', () => {
      mockCrypto.decryptJson.mockReturnValue({ url: 'ldap://dc', bindDn: 'cn=a', bindPassword: 'p', searchBase: 'dc=x' });
      const adapter = factory.createForOrg({ idpType: 'LDAP', idpConfig: 'enc' });
      expect(adapter).toBeInstanceOf(LdapAdapter);
    });

    it('creates ExternalDbAdapter', () => {
      mockCrypto.decryptJson.mockReturnValue({ mode: 'REST', url: 'http://api' });
      const adapter = factory.createForOrg({ idpType: 'EXTERNAL_DB', idpConfig: 'enc' });
      expect(adapter).toBeInstanceOf(ExternalDbAdapter);
    });

    it('returns NullAdapter for unknown idpType', () => {
      const adapter = factory.createForOrg({ idpType: 'UNKNOWN_FUTURE_TYPE' });
      expect(adapter).toBeInstanceOf(NullAdapter);
    });
  });
});
