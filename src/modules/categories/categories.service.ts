import { Injectable, NotFoundException } from '@nestjs/common';
import * as schema from '../../database/schema/index';
import { CategoriesRepository } from './categories.repository';

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
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async findAll(): Promise<CategoryNode[]> {
    const cats = await this.categoriesRepository.findAllActive();
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
    const cat = await this.categoriesRepository.findBySlug(slug);

    if (!cat) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: `Category "${slug}" not found` });
    }

    return cat;
  }

  async findById(id: string) {
    const cat = await this.categoriesRepository.findById(id);

    if (!cat) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }

    return cat;
  }

  async getSubtreeIds(categoryId: string): Promise<string[]> {
    const cat = await this.findById(categoryId);
    return this.categoriesRepository.findSubtreeIds(cat.path);
  }

  async getBreadcrumb(categoryId: string): Promise<typeof schema.categories.$inferSelect[]> {
    const cat = await this.findById(categoryId);
    const pathParts = cat.path.split('.');
    const paths = pathParts.map((_, i) => pathParts.slice(0, i + 1).join('.'));

    return this.categoriesRepository.findByPaths(paths);
  }
}
