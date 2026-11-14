export interface PageQuery {
  page?: number;
  limit?: number;
}

/** Converts page and limit into Prisma skip/take with safe bounds. */
export function toPaging({ page = 1, limit = 20 }: PageQuery) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
}
