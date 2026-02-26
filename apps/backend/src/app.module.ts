import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { SapIntegrationModule } from './sap-integration/sap-integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExpensesModule,
    ApprovalsModule,
    SapIntegrationModule,
  ],
})
export class AppModule {}
