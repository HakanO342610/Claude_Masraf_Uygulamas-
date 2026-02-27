import { PrismaClient, UserRole, ExpenseStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@company.com',
      password: hashedPassword,
      department: 'IT',
      role: UserRole.ADMIN,
    },
  });

  const finance = await prisma.user.upsert({
    where: { email: 'finance@company.com' },
    update: {},
    create: {
      name: 'Finance User',
      email: 'finance@company.com',
      password: hashedPassword,
      department: 'Finance',
      role: UserRole.FINANCE,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@company.com' },
    update: {},
    create: {
      name: 'Manager User',
      email: 'manager@company.com',
      password: hashedPassword,
      department: 'Engineering',
      role: UserRole.MANAGER,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@company.com' },
    update: {},
    create: {
      name: 'Employee User',
      email: 'employee@company.com',
      password: hashedPassword,
      department: 'Engineering',
      role: UserRole.EMPLOYEE,
      managerId: manager.id,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: 'employee2@company.com' },
    update: {},
    create: {
      name: 'Ali Yılmaz',
      email: 'employee2@company.com',
      password: hashedPassword,
      department: 'Sales',
      role: UserRole.EMPLOYEE,
      managerId: manager.id,
    },
  });

  console.log('Users created:', { admin: admin.id, finance: finance.id, manager: manager.id, employee: employee.id });

  // Create expenses
  const categories = ['Travel', 'Accommodation', 'Food & Beverage', 'Transportation', 'Office Supplies'];
  const statuses: ExpenseStatus[] = [
    ExpenseStatus.DRAFT,
    ExpenseStatus.SUBMITTED,
    ExpenseStatus.MANAGER_APPROVED,
    ExpenseStatus.FINANCE_APPROVED,
    ExpenseStatus.POSTED_TO_SAP,
  ];

  const expenses = [];
  for (let i = 0; i < 20; i++) {
    const user = i % 3 === 0 ? employee2 : employee;
    const category = categories[i % categories.length];
    const status = statuses[i % statuses.length];
    const amount = Math.round((Math.random() * 5000 + 100) * 100) / 100;
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));

    const expense = await prisma.expense.create({
      data: {
        userId: user.id,
        expenseDate: date,
        amount,
        currency: 'TRY',
        taxAmount: Math.round(amount * 0.18 * 100) / 100,
        category,
        costCenter: `CC-${1000 + (i % 5)}`,
        description: `${category} expense #${i + 1}`,
        status,
      },
    });
    expenses.push(expense);
  }

  console.log(`Created ${expenses.length} expenses`);

  // Create approvals for submitted+ expenses
  for (const expense of expenses) {
    if (expense.status !== ExpenseStatus.DRAFT) {
      await prisma.approval.create({
        data: {
          expenseId: expense.id,
          approverId: manager.id,
          status:
            expense.status === ExpenseStatus.SUBMITTED ? 'PENDING' : 'APPROVED',
          actionDate:
            expense.status !== ExpenseStatus.SUBMITTED ? new Date() : undefined,
        },
      });
    }

    if (
      expense.status === ExpenseStatus.FINANCE_APPROVED ||
      expense.status === ExpenseStatus.POSTED_TO_SAP
    ) {
      await prisma.approval.create({
        data: {
          expenseId: expense.id,
          approverId: finance.id,
          status: 'APPROVED',
          actionDate: new Date(),
        },
      });
    }
  }

  // Create SAP master data
  const masterData = [
    { type: 'COST_CENTER', code: 'CC-1000', name: 'Engineering' },
    { type: 'COST_CENTER', code: 'CC-1001', name: 'Sales' },
    { type: 'COST_CENTER', code: 'CC-1002', name: 'Marketing' },
    { type: 'COST_CENTER', code: 'CC-1003', name: 'HR' },
    { type: 'COST_CENTER', code: 'CC-1004', name: 'Finance' },
    { type: 'GL_ACCOUNT', code: '6200', name: 'Travel Expenses' },
    { type: 'GL_ACCOUNT', code: '6210', name: 'Accommodation' },
    { type: 'GL_ACCOUNT', code: '6220', name: 'Food & Beverage' },
    { type: 'GL_ACCOUNT', code: '6230', name: 'Office Supplies' },
    { type: 'TAX_CODE', code: 'V1', name: 'KDV %18' },
    { type: 'TAX_CODE', code: 'V0', name: 'KDV Muaf' },
  ];

  for (const data of masterData) {
    await prisma.sapMasterData.upsert({
      where: { type_code: { type: data.type, code: data.code } },
      update: {},
      create: data,
    });
  }

  console.log(`Created ${masterData.length} SAP master data records`);
  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
