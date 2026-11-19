import { Prisma } from '@prisma/client';

/** Lỗi vi phạm unique constraint (P2002). */
export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Không tìm thấy bản ghi để update/delete (P2025). */
export function isNotFound(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Lỗi kết nối DB (máy chủ không phản hồi / chưa sẵn sàng). */
export function isDbUnavailable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P1001', 'P1002', 'P1017'].includes(error.code))
  );
}
