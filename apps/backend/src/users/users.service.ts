import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        sapEmployeeId: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        sapEmployeeId: true,
        managerId: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateRole(id: string, role: UserRole) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async assignManager(userId: string, managerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { managerId },
      select: { id: true, name: true, managerId: true },
    });
  }
}
