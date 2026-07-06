import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  path: string;
  level: number;
  imageUrl: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(): Promise<CategoryNode[]> {
    const cats = await this.db.query.categories.findMany({
      where: eq(schema.categories.isActive, true),
      orderBy: (c, { asc }) => [asc(c.level), asc(c.sortOrder)],
    });
    return this.buildTree(cats);
  }

  buildTree(cats: typeof schema.categories.$inferSelect[]): CategoryNode[] {
    const map = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    for (const cat of cats) {
      map.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of cats) {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findBySlug(slug: string) {
    const cat = await this.db.query.categories.findFirst({
      where: eq(schema.categories.slug, slug),
    });

    if (!cat) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: `Category "${slug}" not found` });
    }

    return cat;
  }

  async findById(id: string) {
    const cat = await this.db.query.categories.findFirst({
      where: eq(schema.categories.id, id),
    });

    if (!cat) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }

    return cat;
  }

  async getSubtreeIds(categoryId: string): Promise<string[]> {
    const cat = await this.findById(categoryId);

    // Use ltree <@ operator for efficient subtree query
    const result = await this.db.execute<{ id: string }>(
      sql`SELECT id FROM categories WHERE path <@ ${cat.path}::ltree AND is_active = true`,
    );

    return result.rows.map((r) => r.id);
  }

  async getBreadcrumb(categoryId: string): Promise<typeof schema.categories.$inferSelect[]> {
    const cat = await this.findById(categoryId);
    const pathParts = cat.path.split('.');
    const paths = pathParts.map((_, i) => pathParts.slice(0, i + 1).join('.'));

    const result = await this.db.execute<typeof schema.categories.$inferSelect>(
      sql`SELECT * FROM categories WHERE path::text = ANY(${paths}) ORDER BY level ASC`,
    );

    return result.rows;
  }
}
