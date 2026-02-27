import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    const testUser = {
      name: 'E2E Test User',
      email: `e2e-${Date.now()}@test.com`,
      password: 'TestPassword123',
    };
    let accessToken: string;
    let refreshToken: string;

    it('POST /api/v1/auth/register — should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /api/v1/auth/login — should login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /api/v1/auth/refresh — should refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /api/v1/auth/logout — should logout', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });
  });

  describe('Expenses', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Expense Test User',
          email: `expense-${Date.now()}@test.com`,
          password: 'TestPassword123',
        });
      accessToken = res.body.accessToken;
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/expenses')
        .expect(401);
    });

    it('POST /api/v1/expenses — should create an expense', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          expenseDate: '2025-01-15',
          amount: 500,
          category: 'Travel',
          description: 'E2E test expense',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.category).toBe('Travel');
    });

    it('GET /api/v1/expenses — should list expenses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/expenses')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('Reports', () => {
    it('should require authentication for reports', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/summary')
        .expect(401);
    });
  });
});
