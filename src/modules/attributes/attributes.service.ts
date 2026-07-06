import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index';
import { DATABASE_TOKEN } from '../../database/database.module';

type AttributeOption = typeof schema.attributeOptions.$inferSelect;
type Attribute = typeof schema.attributes.$inferSelect;

/**
 * Group a flat list of attribute options by their parent attributeId.
 * Options within each group preserve the sortOrder from the query.
 */
function groupOptionsByAttribute(options: AttributeOption[]): Map<string, AttributeOption[]> {
  const map = new Map<string, AttributeOption[]>();
  for (const opt of options) {
    const list = map.get(opt.attributeId) ?? [];
    list.push(opt);
    map.set(opt.attributeId, list);
  }
  return map;
}

@Injectable()
export class AttributesService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Returns all attributes with their options, each sorted by sortOrder.
   *
   * Implementation note: Drizzle's relational query builder loses type
   * inference for `orderBy` callbacks nested inside `with: {...}` (the
   * callback parameters become implicit `any`). We avoid this entirely by
   * running two flat, fully-typed top-level queries and grouping in JS —
   * this is also cheap: the full attribute+option catalog is small
   * (~13 attributes / ~70 options per the seed data) and rarely changes.
   */
  async findAll(): Promise<Array<Attribute & { options: AttributeOption[] }>> {
    const [attrs, options] = await Promise.all([
      this.db.query.attributes.findMany({
        orderBy: (a, { asc }) => [asc(a.sortOrder)],
      }),
      this.db.query.attributeOptions.findMany({
        orderBy: (o, { asc }) => [asc(o.sortOrder)],
      }),
    ]);

    const optionsByAttr = groupOptionsByAttribute(options);

    return attrs.map((a) => ({ ...a, options: optionsByAttr.get(a.id) ?? [] }));
  }

  async findByCode(code: string): Promise<Attribute & { options: AttributeOption[] }> {
    const attr = await this.db.query.attributes.findFirst({
      where: eq(schema.attributes.code, code),
    });

    if (!attr) {
      throw new NotFoundException({ code: 'ATTRIBUTE_NOT_FOUND', message: `Attribute "${code}" not found` });
    }

    const options = await this.db.query.attributeOptions.findMany({
      where: eq(schema.attributeOptions.attributeId, attr.id),
      orderBy: (o, { asc }) => [asc(o.sortOrder)],
    });

    return { ...attr, options };
  }

  /**
   * Returns the attributes applicable to a category, each with its sorted
   * options and the category-specific isRequired/isVariantAttribute flags.
   */
  async getForCategory(categoryId: string): Promise<
    Array<Attribute & { options: AttributeOption[]; isRequired: boolean; isVariantAttribute: boolean }>
  > {
    const cat = await this.db.query.categories.findFirst({
      where: eq(schema.categories.id, categoryId),
    });

    if (!cat) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }

    const catAttrs = await this.db.query.categoryAttributes.findMany({
      where: eq(schema.categoryAttributes.categoryId, categoryId),
      orderBy: (ca, { asc }) => [asc(ca.sortOrder)],
    });

    const attributeIds = catAttrs.map((ca) => ca.attributeId);
    if (attributeIds.length === 0) return [];

    const [attrs, options] = await Promise.all([
      this.db.query.attributes.findMany({
        where: inArray(schema.attributes.id, attributeIds),
      }),
      this.db.query.attributeOptions.findMany({
        where: inArray(schema.attributeOptions.attributeId, attributeIds),
        orderBy: (o, { asc }) => [asc(o.sortOrder)],
      }),
    ]);

    const optionsByAttr = groupOptionsByAttribute(options);
    const catAttrById = new Map(catAttrs.map((ca) => [ca.attributeId, ca]));

    // Preserve the category-defined sortOrder (catAttrs order), not attrs' own order
    return attributeIds
      .map((id) => attrs.find((a) => a.id === id))
      .filter((a): a is Attribute => a !== undefined)
      .map((attr) => {
        const catAttr = catAttrById.get(attr.id);
        return {
          ...attr,
          options: optionsByAttr.get(attr.id) ?? [],
          isRequired: catAttr?.isRequired ?? false,
          isVariantAttribute: catAttr?.isVariantAttribute ?? false,
        };
      });
  }
}
