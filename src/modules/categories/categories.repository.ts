import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

@Injectable()
export class CategoriesRepository {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findAllActive() {
    return this.db.query.categories.findMany({
      where: eq(schema.categories.isActive, true),
      orderBy: (c, { asc }) => [asc(c.level), asc(c.sortOrder)],
    });
  }

  findBySlug(slug: string) {
    return this.db.query.categories.findFirst({
      where: eq(schema.categories.slug, slug),
    });
  }

  findById(id: string) {
    return this.db.query.categories.findFirst({
      where: eq(schema.categories.id, id),
    });
  }

  async findSubtreeIds(path: string): Promise<string[]> {
    // Use ltree <@ operator for efficient subtree query
    const result = await this.db.execute<{ id: string }>(
      sql`SELECT id FROM categories WHERE path <@ ${path}::ltree AND is_active = true`,
    );

    return result.rows.map((r) => r.id);
  }

  async findByPaths(paths: string[]): Promise<typeof schema.categories.$inferSelect[]> {
    const result = await this.db.execute<typeof schema.categories.$inferSelect>(
      sql`SELECT * FROM categories WHERE path::text = ANY(${paths}) ORDER BY level ASC`,
    );

    return result.rows;
  }
}
