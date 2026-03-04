import { PrismaClient, UserRole, ExpenseStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const seedUserBase = { password: hashedPassword, isEmailConfirmed: true, isApproved: true };

  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: { ...seedUserBase },
    create: {
      name: 'Admin User',
      email: 'admin@company.com',
      department: 'IT',
      role: UserRole.ADMIN,
      ...seedUserBase,
    },
  });

  const finance = await prisma.user.upsert({
    where: { email: 'finance@company.com' },
    update: { ...seedUserBase },
    create: {
      name: 'Finance User',
      email: 'finance@company.com',
      department: 'Finance',
      role: UserRole.FINANCE,
      ...seedUserBase,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@company.com' },
    update: { ...seedUserBase },
    create: {
      name: 'Manager User',
      email: 'manager@company.com',
      department: 'Engineering',
      role: UserRole.MANAGER,
      ...seedUserBase,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@company.com' },
    update: { ...seedUserBase },
    create: {
      name: 'Employee User',
      email: 'employee@company.com',
      department: 'Engineering',
      role: UserRole.EMPLOYEE,
      managerId: manager.id,
      ...seedUserBase,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: 'employee2@company.com' },
    update: { ...seedUserBase },
    create: {
      name: 'Ali Yılmaz',
      email: 'employee2@company.com',
      department: 'Sales',
      role: UserRole.EMPLOYEE,
      managerId: manager.id,
      ...seedUserBase,
    },
  });

  console.log('Users created:', { admin: admin.id, finance: finance.id, manager: manager.id, employee: employee.id });

  // ─── Organization ─────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Şirketi A.Ş.',
      slug: 'demo-company',
      plan: 'ENTERPRISE',
      erpType: 'NONE',
      idpType: 'NONE',
      setupModel: 'STANDALONE',
    },
  });

  // ─── Departments (3-level hierarchy) ─────────────────────────────────
  const deptRoot = await prisma.department.upsert({
    where: { code_organizationId: { code: 'GM', organizationId: org.id } },
    update: {},
    create: { name: 'Genel Müdürlük', code: 'GM', level: 0, organizationId: org.id, managerId: admin.id },
  });
  const deptIT = await prisma.department.upsert({
    where: { code_organizationId: { code: 'BT', organizationId: org.id } },
    update: {},
    create: { name: 'Bilgi Teknolojileri', code: 'BT', level: 1, parentId: deptRoot.id, organizationId: org.id, managerId: manager.id },
  });
  const deptFinance = await prisma.department.upsert({
    where: { code_organizationId: { code: 'FIN', organizationId: org.id } },
    update: {},
    create: { name: 'Finans', code: 'FIN', level: 1, parentId: deptRoot.id, organizationId: org.id, managerId: finance.id },
  });
  const deptSales = await prisma.department.upsert({
    where: { code_organizationId: { code: 'SAT', organizationId: org.id } },
    update: {},
    create: { name: 'Satış', code: 'SAT', level: 1, parentId: deptRoot.id, organizationId: org.id },
  });
  const deptSW = await prisma.department.upsert({
    where: { code_organizationId: { code: 'BT-SW', organizationId: org.id } },
    update: {},
    create: { name: 'Yazılım Geliştirme', code: 'BT-SW', level: 2, parentId: deptIT.id, organizationId: org.id, managerId: manager.id },
  });
  await prisma.department.upsert({
    where: { code_organizationId: { code: 'BT-INF', organizationId: org.id } },
    update: {},
    create: { name: 'Altyapı & Operasyon', code: 'BT-INF', level: 2, parentId: deptIT.id, organizationId: org.id },
  });
  console.log('Departments created: GM → BT, FIN, SAT → BT-SW, BT-INF');

  // ─── Positions ────────────────────────────────────────────────────────
  const posGM = await prisma.position.upsert({
    where: { code_organizationId: { code: 'POS-GM', organizationId: org.id } },
    update: {},
    create: { title: 'Genel Müdür', code: 'POS-GM', level: 0, departmentId: deptRoot.id, organizationId: org.id },
  });
  const posITDir = await prisma.position.upsert({
    where: { code_organizationId: { code: 'POS-IT-DIR', organizationId: org.id } },
    update: {},
    create: { title: 'IT Direktörü', code: 'POS-IT-DIR', level: 1, departmentId: deptIT.id, parentPositionId: posGM.id, organizationId: org.id },
  });
  const posSWMgr = await prisma.position.upsert({
    where: { code_organizationId: { code: 'POS-SW-MGR', organizationId: org.id } },
    update: {},
    create: { title: 'Yazılım Müdürü', code: 'POS-SW-MGR', level: 2, departmentId: deptSW.id, parentPositionId: posITDir.id, organizationId: org.id },
  });
  const posSrDev = await prisma.position.upsert({
    where: { code_organizationId: { code: 'POS-SR-DEV', organizationId: org.id } },
    update: {},
    create: { title: 'Kıdemli Yazılım Mühendisi', code: 'POS-SR-DEV', level: 3, departmentId: deptSW.id, parentPositionId: posSWMgr.id, organizationId: org.id },
  });
  const posDev = await prisma.position.upsert({
    where: { code_organizationId: { code: 'POS-DEV', organizationId: org.id } },
    update: {},
    create: { title: 'Yazılım Mühendisi', code: 'POS-DEV', level: 4, departmentId: deptSW.id, parentPositionId: posSrDev.id, organizationId: org.id },
  });
  const posFinMgr = await prisma.position.upsert({
    where: { code_organizationId: { code: 'POS-FIN-MGR', organizationId: org.id } },
    update: {},
    create: { title: 'Finans Müdürü', code: 'POS-FIN-MGR', level: 1, departmentId: deptFinance.id, parentPositionId: posGM.id, organizationId: org.id },
  });
  const posSalesMgr = await prisma.position.upsert({
    where: { code_organizationId: { code: 'POS-SALES-MGR', organizationId: org.id } },
    update: {},
    create: { title: 'Satış Müdürü', code: 'POS-SALES-MGR', level: 1, departmentId: deptSales.id, parentPositionId: posGM.id, organizationId: org.id },
  });
  console.log('Positions created: GM → IT Dir, Fin Mgr, Sales Mgr → SW Mgr → Sr Dev → Dev');

  // ─── Link users to departments + positions ─────────────────────────────
  await prisma.user.update({ where: { id: admin.id },
    data: { departmentId: deptRoot.id, positionId: posGM.id, jobTitle: 'Genel Müdür', organizationId: org.id } });
  await prisma.user.update({ where: { id: manager.id },
    data: { departmentId: deptIT.id, positionId: posITDir.id, jobTitle: 'IT Direktörü', organizationId: org.id, upperManagerId: admin.id } });
  await prisma.user.update({ where: { id: finance.id },
    data: { departmentId: deptFinance.id, positionId: posFinMgr.id, jobTitle: 'Finans Müdürü', organizationId: org.id, upperManagerId: admin.id } });
  await prisma.user.update({ where: { id: employee.id },
    data: { departmentId: deptSW.id, positionId: posDev.id, jobTitle: 'Yazılım Mühendisi', organizationId: org.id, upperManagerId: admin.id } });
  await prisma.user.update({ where: { id: employee2.id },
    data: { departmentId: deptSales.id, positionId: posSalesMgr.id, jobTitle: 'Satış Müdürü', organizationId: org.id, upperManagerId: admin.id } });
  console.log('Users linked: dept + position + upperManager');

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
