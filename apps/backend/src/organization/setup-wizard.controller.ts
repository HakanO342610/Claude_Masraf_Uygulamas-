import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationService } from './organization.service';
import { UserSyncService } from '../identity/user-sync.service';
import { IdentityAdapterFactory } from '../identity/adapters/identity-adapter.factory';
import { CryptoService } from '../common/crypto.service';

export interface SetupWizardDto {
  organizationName: string;
  organizationSlug: string;
  setupModel: 'STANDALONE' | 'SAP_HR' | 'DIRECTORY';

  // Model B: SAP HR
  sapSystemType?: 'ECC_HCM' | 'S4_ONPREM' | 'S4_CLOUD';
  sapConfig?: {
    url: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    companyId?: string;
    tokenUrl?: string;
    userListPath?: string;
  };

  // Model C: Directory
  directoryType?: 'LDAP' | 'AZURE_AD' | 'EXTERNAL_DB';
  directoryConfig?: {
    url?: string;
    bindDn?: string;
    bindPassword?: string;
    searchBase?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    mode?: 'REST' | 'DB';
    apiKey?: string;
    dbConnectionString?: string;
    dbUserQuery?: string;
    dbDeptQuery?: string;
  };
}

@ApiTags('Setup Wizard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('setup')
export class SetupWizardController {
  constructor(
    private orgService: OrganizationService,
    private syncService: UserSyncService,
    private adapterFactory: IdentityAdapterFactory,
    private crypto: CryptoService,
  ) {}

  /** Adım 1: Mevcut kurulum durumunu getir */
  @Get('status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get current setup status' })
  async getSetupStatus() {
    const orgs = await this.orgService.findAll();
    const envIdpType = process.env.IDENTITY_PROVIDER || 'NONE';

    return {
      hasOrganization: orgs.length > 0,
      organizations: orgs,
      envIdentityProvider: envIdpType,
      setupModels: [
        {
          value: 'STANDALONE',
          label: 'Standalone',
          description: 'Kullanıcılar ürün içinden manuel yönetilir. Organizasyon şeması ürün içinden kurgulanır.',
          icon: '🏠',
        },
        {
          value: 'SAP_HR',
          label: 'SAP HR Entegrasyon',
          description: 'SAP ECC/S4/Cloud HR sisteminden kullanıcılar ve organizasyon şeması otomatik senkronize edilir.',
          icon: '🏭',
          subOptions: [
            { value: 'ECC_HCM', label: 'SAP ECC + HCM (PA/OM)', description: 'SICF REST — ZCL_EXPENSE_USER_LIST' },
            { value: 'S4_ONPREM', label: 'SAP S/4HANA On-Premise', description: 'OData V2/V4 API' },
            { value: 'S4_CLOUD', label: 'SAP S/4HANA Cloud / Rise (SuccessFactors)', description: 'SuccessFactors OData API + OAuth2' },
          ],
        },
        {
          value: 'DIRECTORY',
          label: 'Directory / External Entegrasyon',
          description: 'LDAP, Azure AD veya harici bir veritabanından kullanıcılar senkronize edilir. Organizasyon şeması ürün içinden yönetilir.',
          icon: '🌐',
          subOptions: [
            { value: 'LDAP', label: 'LDAP / Active Directory', description: 'On-premise AD / OpenLDAP' },
            { value: 'AZURE_AD', label: 'Azure AD / Entra ID', description: 'Microsoft Graph API + OAuth2' },
            { value: 'EXTERNAL_DB', label: 'Harici DB / REST API', description: 'PostgreSQL/MySQL view veya REST endpoint' },
          ],
        },
      ],
    };
  }

  /** Adım 2: Bağlantı testi */
  @Post('test-connection')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test identity provider connection' })
  async testConnection(@Body() body: SetupWizardDto) {
    const idpType = this.resolveIdpType(body);
    const config = this.resolveConfig(body);
    const adapter = this.adapterFactory['createForType'](idpType as any, config);
    return adapter.testConnection();
  }

  /** Adım 3: Kurulumu tamamla (org oluştur + ilk sync) */
  @Post('complete')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Complete setup wizard — create org + initial sync' })
  async completeSetup(@Body() body: SetupWizardDto) {
    const idpType = this.resolveIdpType(body);
    const erpType = body.setupModel === 'SAP_HR' ? (body.sapSystemType || 'NONE') : 'NONE';
    const config = this.resolveConfig(body);

    // Organizasyon oluştur
    const org = await this.orgService.create({
      name: body.organizationName,
      slug: body.organizationSlug,
      plan: 'ENTERPRISE',
      erpType,
      erpConfig: body.setupModel === 'SAP_HR' ? config : null,
      idpType,
      idpConfig: config,
    });

    // setupModel güncelle
    await this.orgService.update(org.id, { setupModel: body.setupModel } as any);

    // STANDALONE değilse ilk sync yap
    let syncResult = null;
    if (body.setupModel !== 'STANDALONE') {
      try {
        syncResult = await this.syncService.syncForOrg(org.id);
      } catch (err: any) {
        syncResult = { error: err.message };
      }
    }

    return {
      organization: org,
      setupModel: body.setupModel,
      idpType,
      syncResult,
      message: body.setupModel === 'STANDALONE'
        ? 'Organizasyon oluşturuldu. Kullanıcıları ve departmanları manuel olarak ekleyebilirsiniz.'
        : `Organizasyon oluşturuldu ve ilk senkronizasyon ${(syncResult as any)?.error ? 'başarısız' : 'tamamlandı'}.`,
    };
  }

  /** Adım 4: Önizleme — sync yapmadan veri çek */
  @Post('preview')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Preview sync data without applying' })
  async previewSync(@Body() body: SetupWizardDto) {
    const idpType = this.resolveIdpType(body);
    const config = this.resolveConfig(body);
    const adapter = this.adapterFactory['createForType'](idpType as any, config);

    const users = await adapter.syncUsers();
    const orgUnits = adapter.syncOrgUnits ? await adapter.syncOrgUnits() : [];
    const positions = adapter.syncPositions ? await adapter.syncPositions() : [];

    return {
      users: {
        total: users.length,
        active: users.filter(u => u.isActive).length,
        sample: users.slice(0, 10), // İlk 10 kayıt önizleme
      },
      orgUnits: {
        total: orgUnits.length,
        sample: orgUnits.slice(0, 10),
      },
      positions: {
        total: positions.length,
        sample: positions.slice(0, 10),
      },
    };
  }

  // ─── Yardımcı ──────────────────────────────────────────────────────────

  private resolveIdpType(body: SetupWizardDto): string {
    if (body.setupModel === 'STANDALONE') return 'NONE';
    if (body.setupModel === 'SAP_HR') {
      switch (body.sapSystemType) {
        case 'ECC_HCM': return 'SAP_HCM';
        case 'S4_ONPREM': return 'SAP_S4_ONPREM';
        case 'S4_CLOUD': return 'SAP_S4_CLOUD';
        default: return 'SAP_HCM';
      }
    }
    if (body.setupModel === 'DIRECTORY') {
      return body.directoryType || 'AZURE_AD';
    }
    return 'NONE';
  }

  private resolveConfig(body: SetupWizardDto): Record<string, any> | null {
    if (body.setupModel === 'STANDALONE') return null;
    if (body.setupModel === 'SAP_HR') return body.sapConfig || null;
    if (body.setupModel === 'DIRECTORY') return body.directoryConfig || null;
    return null;
  }
}
