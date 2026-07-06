import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from '../schema/index';

dotenv.config();

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://mayalu:secret@localhost:5432/mayalu_wears',
});

const db = drizzle(pool, { schema });

async function seedPlans(): Promise<void> {
  console.log('  Seeding plans...');
  await db.insert(schema.plans).values([
    {
      name: 'Starter',
      slug: 'starter',
      description: 'Perfect for new sellers starting out',
      billingCycle: 'monthly',
      price: '0',
      status: 'active',
      isPublic: true,
      sortOrder: 1,
      maxProducts: 50,
      maxVariantsPerProduct: 10,
      maxImagesPerProduct: 5,
      maxWarehouses: 1,
      maxStaffMembers: 1,
      storageGb: '2',
      canUseCod: true,
      canUseEsewa: false,
      canUseDiscounts: false,
      canUseAnalytics: false,
      canUseCustomDomain: false,
      canUseBulkImport: false,
      canUseSeoTools: false,
      canUseProductVideos: false,
      canManageReturns: false,
      commissionRate: '5',
    },
    {
      name: 'Growth',
      slug: 'growth',
      description: 'For growing businesses with advanced features',
      billingCycle: 'monthly',
      price: '999',
      status: 'active',
      isPublic: true,
      sortOrder: 2,
      maxProducts: 500,
      maxVariantsPerProduct: 20,
      maxImagesPerProduct: 10,
      maxWarehouses: 3,
      maxStaffMembers: 5,
      storageGb: '20',
      canUseCod: true,
      canUseEsewa: true,
      canUseDiscounts: true,
      canUseAnalytics: true,
      canUseCustomDomain: false,
      canUseBulkImport: false,
      canUseSeoTools: false,
      canUseProductVideos: false,
      canManageReturns: false,
      commissionRate: '3',
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'Unlimited everything for established businesses',
      billingCycle: 'monthly',
      price: '2999',
      status: 'active',
      isPublic: true,
      sortOrder: 3,
      maxProducts: -1,
      maxVariantsPerProduct: -1,
      maxImagesPerProduct: -1,
      maxWarehouses: -1,
      maxStaffMembers: -1,
      storageGb: '100',
      canUseCod: true,
      canUseEsewa: true,
      canUseDiscounts: true,
      canUseAnalytics: true,
      canUseCustomDomain: true,
      canUseBulkImport: true,
      canUseSeoTools: true,
      canUseProductVideos: true,
      canManageReturns: true,
      commissionRate: '2',
    },
  ]).onConflictDoNothing();
  console.log('  ✓ Plans seeded');
}

async function seedCategories(): Promise<void> {
  console.log('  Seeding categories...');

  const cats = [
    // Level 0 — root
    { slug: 'women', name: 'Women', path: 'women', level: 0, sortOrder: 1 },
    { slug: 'men', name: 'Men', path: 'men', level: 0, sortOrder: 2 },
    { slug: 'electronics', name: 'Electronics', path: 'electronics', level: 0, sortOrder: 3 },
    { slug: 'jewellery', name: 'Jewellery', path: 'jewellery', level: 0, sortOrder: 4 },
    { slug: 'home_living', name: 'Home & Living', path: 'home_living', level: 0, sortOrder: 5 },
  ];

  for (const cat of cats) {
    await db.insert(schema.categories).values(cat).onConflictDoNothing();
  }

  // Fetch root categories to get IDs
  const roots = await db.query.categories.findMany({
    where: (c, { inArray }) => inArray(c.slug, ['women', 'men', 'electronics', 'jewellery', 'home_living']),
  });

  const bySlug = Object.fromEntries(roots.map((r) => [r.slug, r]));

  const subCats = [
    // Women
    { slug: 'kurti', name: 'Kurti', path: 'women.kurti', level: 1, parentSlug: 'women', sortOrder: 1 },
    { slug: 'saree', name: 'Saree', path: 'women.saree', level: 1, parentSlug: 'women', sortOrder: 2 },
    { slug: 'lehenga', name: 'Lehenga', path: 'women.lehenga', level: 1, parentSlug: 'women', sortOrder: 3 },
    { slug: 'dupatta', name: 'Dupatta', path: 'women.dupatta', level: 1, parentSlug: 'women', sortOrder: 4 },
    { slug: 'salwar_suit', name: 'Salwar Suit', path: 'women.salwar_suit', level: 1, parentSlug: 'women', sortOrder: 5 },
    { slug: 'tops_tees', name: 'Tops & Tees', path: 'women.tops_tees', level: 1, parentSlug: 'women', sortOrder: 6 },
    // Men
    { slug: 'shirts', name: 'Shirts', path: 'men.shirts', level: 1, parentSlug: 'men', sortOrder: 1 },
    { slug: 'trousers', name: 'Trousers', path: 'men.trousers', level: 1, parentSlug: 'men', sortOrder: 2 },
    { slug: 'kurta', name: 'Kurta', path: 'men.kurta', level: 1, parentSlug: 'men', sortOrder: 3 },
    // Electronics
    { slug: 'mobiles', name: 'Mobiles', path: 'electronics.mobiles', level: 1, parentSlug: 'electronics', sortOrder: 1 },
    { slug: 'laptops', name: 'Laptops', path: 'electronics.laptops', level: 1, parentSlug: 'electronics', sortOrder: 2 },
    { slug: 'accessories', name: 'Accessories', path: 'electronics.accessories', level: 1, parentSlug: 'electronics', sortOrder: 3 },
    { slug: 'appliances', name: 'Appliances', path: 'electronics.appliances', level: 1, parentSlug: 'electronics', sortOrder: 4 },
    // Jewellery
    { slug: 'earrings', name: 'Earrings', path: 'jewellery.earrings', level: 1, parentSlug: 'jewellery', sortOrder: 1 },
    { slug: 'necklace', name: 'Necklace', path: 'jewellery.necklace', level: 1, parentSlug: 'jewellery', sortOrder: 2 },
    { slug: 'bangles', name: 'Bangles', path: 'jewellery.bangles', level: 1, parentSlug: 'jewellery', sortOrder: 3 },
    // Home & Living
    { slug: 'bedding', name: 'Bedding', path: 'home_living.bedding', level: 1, parentSlug: 'home_living', sortOrder: 1 },
    { slug: 'decor', name: 'Decor', path: 'home_living.decor', level: 1, parentSlug: 'home_living', sortOrder: 2 },
    { slug: 'kitchen', name: 'Kitchen', path: 'home_living.kitchen', level: 1, parentSlug: 'home_living', sortOrder: 3 },
  ];

  for (const sub of subCats) {
    const parent = bySlug[sub.parentSlug];
    if (parent) {
      await db.insert(schema.categories).values({
        slug: sub.slug,
        name: sub.name,
        path: sub.path,
        level: sub.level,
        parentId: parent.id,
        sortOrder: sub.sortOrder,
      }).onConflictDoNothing();
    }
  }
  console.log('  ✓ Categories seeded');
}

async function seedAttributes(): Promise<void> {
  console.log('  Seeding attributes...');

  const attrs = [
    { code: 'color', name: 'Color', inputType: 'color' as const, isFilterable: true },
    { code: 'size', name: 'Size', inputType: 'size' as const, isFilterable: true },
    { code: 'fabric', name: 'Fabric', inputType: 'select' as const, isFilterable: true },
    { code: 'work_type', name: 'Work Type', inputType: 'multi_select' as const, isFilterable: true },
    { code: 'occasion', name: 'Occasion', inputType: 'multi_select' as const, isFilterable: true },
    { code: 'care', name: 'Care Instructions', inputType: 'text' as const },
    { code: 'brand', name: 'Brand', inputType: 'select' as const, isFilterable: true },
    { code: 'ram', name: 'RAM', inputType: 'select' as const, isFilterable: true },
    { code: 'storage', name: 'Storage', inputType: 'select' as const, isFilterable: true },
    { code: 'warranty', name: 'Warranty', inputType: 'text' as const },
    { code: 'battery', name: 'Battery', inputType: 'text' as const },
    { code: 'material', name: 'Material', inputType: 'select' as const, isFilterable: true },
    { code: 'stone_type', name: 'Stone Type', inputType: 'select' as const, isFilterable: true },
  ];

  for (const attr of attrs) {
    await db.insert(schema.attributes).values({ ...attr, sortOrder: 0 }).onConflictDoNothing();
  }

  const allAttrs = await db.query.attributes.findMany();
  const attrByCode = Object.fromEntries(allAttrs.map((a) => [a.code, a]));

  // Seed attribute options
  const options: { code: string; value: string; label: string; colorHex?: string }[] = [
    { code: 'color', value: 'red', label: 'Red', colorHex: '#FF0000' },
    { code: 'color', value: 'blue', label: 'Blue', colorHex: '#0000FF' },
    { code: 'color', value: 'green', label: 'Green', colorHex: '#008000' },
    { code: 'color', value: 'yellow', label: 'Yellow', colorHex: '#FFFF00' },
    { code: 'color', value: 'white', label: 'White', colorHex: '#FFFFFF' },
    { code: 'color', value: 'black', label: 'Black', colorHex: '#000000' },
    { code: 'color', value: 'maroon', label: 'Maroon', colorHex: '#800000' },
    { code: 'color', value: 'pink', label: 'Pink', colorHex: '#FFC0CB' },
    { code: 'color', value: 'purple', label: 'Purple', colorHex: '#800080' },
    { code: 'color', value: 'orange', label: 'Orange', colorHex: '#FFA500' },
    { code: 'size', value: 'xs', label: 'XS' },
    { code: 'size', value: 's', label: 'S' },
    { code: 'size', value: 'm', label: 'M' },
    { code: 'size', value: 'l', label: 'L' },
    { code: 'size', value: 'xl', label: 'XL' },
    { code: 'size', value: 'xxl', label: 'XXL' },
    { code: 'size', value: 'xxxl', label: 'XXXL' },
    { code: 'size', value: '36', label: '36' },
    { code: 'size', value: '38', label: '38' },
    { code: 'size', value: '40', label: '40' },
    { code: 'size', value: '42', label: '42' },
    { code: 'size', value: '44', label: '44' },
    { code: 'fabric', value: 'cotton', label: 'Cotton' },
    { code: 'fabric', value: 'silk', label: 'Silk' },
    { code: 'fabric', value: 'georgette', label: 'Georgette' },
    { code: 'fabric', value: 'chiffon', label: 'Chiffon' },
    { code: 'fabric', value: 'rayon', label: 'Rayon' },
    { code: 'fabric', value: 'polyester', label: 'Polyester' },
    { code: 'fabric', value: 'linen', label: 'Linen' },
    { code: 'fabric', value: 'denim', label: 'Denim' },
    { code: 'fabric', value: 'velvet', label: 'Velvet' },
    { code: 'work_type', value: 'embroidered', label: 'Embroidered' },
    { code: 'work_type', value: 'printed', label: 'Printed' },
    { code: 'work_type', value: 'solid', label: 'Solid' },
    { code: 'work_type', value: 'handloom', label: 'Handloom' },
    { code: 'work_type', value: 'zari_work', label: 'Zari Work' },
    { code: 'work_type', value: 'mirror_work', label: 'Mirror Work' },
    { code: 'occasion', value: 'casual', label: 'Casual' },
    { code: 'occasion', value: 'festive', label: 'Festive' },
    { code: 'occasion', value: 'wedding', label: 'Wedding' },
    { code: 'occasion', value: 'party', label: 'Party' },
    { code: 'occasion', value: 'office', label: 'Office' },
    { code: 'occasion', value: 'daily_wear', label: 'Daily Wear' },
    { code: 'brand', value: 'samsung', label: 'Samsung' },
    { code: 'brand', value: 'apple', label: 'Apple' },
    { code: 'brand', value: 'xiaomi', label: 'Xiaomi' },
    { code: 'brand', value: 'oneplus', label: 'OnePlus' },
    { code: 'brand', value: 'realme', label: 'Realme' },
    { code: 'brand', value: 'hp', label: 'HP' },
    { code: 'brand', value: 'dell', label: 'Dell' },
    { code: 'brand', value: 'lenovo', label: 'Lenovo' },
    { code: 'brand', value: 'asus', label: 'Asus' },
    { code: 'ram', value: '4gb', label: '4GB' },
    { code: 'ram', value: '6gb', label: '6GB' },
    { code: 'ram', value: '8gb', label: '8GB' },
    { code: 'ram', value: '12gb', label: '12GB' },
    { code: 'ram', value: '16gb', label: '16GB' },
    { code: 'ram', value: '32gb', label: '32GB' },
    { code: 'storage', value: '64gb', label: '64GB' },
    { code: 'storage', value: '128gb', label: '128GB' },
    { code: 'storage', value: '256gb', label: '256GB' },
    { code: 'storage', value: '512gb', label: '512GB' },
    { code: 'storage', value: '1tb', label: '1TB' },
    { code: 'material', value: 'gold', label: 'Gold' },
    { code: 'material', value: 'silver', label: 'Silver' },
    { code: 'material', value: 'rose_gold', label: 'Rose Gold' },
    { code: 'material', value: 'oxidised', label: 'Oxidised' },
    { code: 'material', value: 'artificial', label: 'Artificial' },
    { code: 'material', value: 'platinum', label: 'Platinum' },
    { code: 'stone_type', value: 'diamond', label: 'Diamond' },
    { code: 'stone_type', value: 'ruby', label: 'Ruby' },
    { code: 'stone_type', value: 'pearl', label: 'Pearl' },
    { code: 'stone_type', value: 'emerald', label: 'Emerald' },
    { code: 'stone_type', value: 'sapphire', label: 'Sapphire' },
    { code: 'stone_type', value: 'cubic_zirconia', label: 'Cubic Zirconia' },
  ];

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const attr = attrByCode[opt.code];
    if (attr) {
      await db.insert(schema.attributeOptions).values({
        attributeId: attr.id,
        value: opt.value,
        label: opt.label,
        colorHex: opt.colorHex,
        sortOrder: i,
      }).onConflictDoNothing();
    }
  }
  console.log('  ✓ Attributes seeded');
}

async function seedDeliveryZones(): Promise<void> {
  console.log('  Seeding delivery zones...');

  await db.insert(schema.deliveryZones).values([
    {
      name: 'Kathmandu Valley',
      code: 'KTM',
      cities: ['Kathmandu', 'Lalitpur', 'Bhaktapur'],
      districts: ['Kathmandu', 'Lalitpur', 'Bhaktapur'],
      isActive: true,
    },
    {
      name: 'Pokhara',
      code: 'PKR',
      cities: ['Pokhara'],
      districts: ['Kaski'],
      isActive: true,
    },
    {
      name: 'Biratnagar',
      code: 'BRT',
      cities: ['Biratnagar', 'Itahari', 'Dharan'],
      districts: ['Morang', 'Sunsari'],
      isActive: true,
    },
    {
      name: 'Chitwan',
      code: 'CTW',
      cities: ['Bharatpur', 'Narayangarh'],
      districts: ['Chitwan'],
      isActive: true,
    },
    {
      name: 'Butwal',
      code: 'BTW',
      cities: ['Butwal', 'Tansen'],
      districts: ['Rupandehi', 'Palpa'],
      isActive: true,
    },
    {
      name: 'Remote Areas',
      code: 'REMOTE',
      cities: [],
      districts: ['Humla', 'Dolpa', 'Mustang', 'Mugu'],
      isActive: true,
    },
  ]).onConflictDoNothing();

  // Seed carrier routes after zones exist
  const zones = await db.query.deliveryZones.findMany();
  const zoneByCode = Object.fromEntries(zones.map((z) => [z.code, z]));

  const routes = [
    // KTM → KTM (same valley — free)
    { carrier: 'IntraCityExpress', from: 'KTM', to: 'KTM', min: 1, max: 2, base: '0', cod: true },
    // KTM → PKR
    { carrier: 'SundaraCarrier', from: 'KTM', to: 'PKR', min: 2, max: 3, base: '150', cod: true },
    { carrier: 'NepBike', from: 'KTM', to: 'PKR', min: 3, max: 5, base: '100', cod: true },
    // KTM → BRT
    { carrier: 'SundaraCarrier', from: 'KTM', to: 'BRT', min: 3, max: 5, base: '200', cod: true },
    // KTM → CTW
    { carrier: 'SundaraCarrier', from: 'KTM', to: 'CTW', min: 2, max: 4, base: '150', cod: true },
    // KTM → BTW
    { carrier: 'SundaraCarrier', from: 'KTM', to: 'BTW', min: 3, max: 5, base: '180', cod: true },
    // KTM → REMOTE
    { carrier: 'AirCargo', from: 'KTM', to: 'REMOTE', min: 7, max: 14, base: '500', cod: false },
  ];

  for (const route of routes) {
    const origin = zoneByCode[route.from];
    const dest = zoneByCode[route.to];
    if (origin && dest) {
      await db.insert(schema.carrierZoneRoutes).values({
        carrierCode: route.carrier.toLowerCase(),
        carrierName: route.carrier,
        originZoneId: origin.id,
        destZoneId: dest.id,
        isActive: true,
        minDays: route.min,
        maxDays: route.max,
        baseCostNpr: route.base,
        perKgCostNpr: '10',
        supportsCod: route.cod,
        sortOrder: 0,
      }).onConflictDoNothing();
    }
  }
  console.log('  ✓ Delivery zones seeded');
}

async function main(): Promise<void> {
  console.log('🌱 Starting seed...');
  try {
    await seedPlans();
    await seedCategories();
    await seedAttributes();
    await seedDeliveryZones();
    await seedNepalPincodes();
    await seedSearchVectorTrigger();
    await seedSpecialIndexes();
    console.log('✅ Seed complete!');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();

async function seedSearchVectorTrigger(): Promise<void> {
  console.log('  Seeding search vector trigger...');
  // PostgreSQL trigger: auto-update search_vector on product insert/update
  await pool.query(`
    CREATE OR REPLACE FUNCTION update_product_search_vector()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.short_description, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_product_search_vector ON products;

    CREATE TRIGGER trg_product_search_vector
      BEFORE INSERT OR UPDATE OF name, short_description, description
      ON products
      FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();
  `);
  console.log('  ✓ Search vector trigger created');
}

async function seedNepalPincodes(): Promise<void> {
  console.log('  Seeding Nepal pincodes...');
  const zones = await db.query.deliveryZones.findMany();
  const zoneByCode = Object.fromEntries(zones.map((z) => [z.code, z]));

  const pincodes: { pincode: string; code: string }[] = [
    // KTM Valley (44600-44809)
    { pincode: '44600', code: 'KTM' }, { pincode: '44601', code: 'KTM' },
    { pincode: '44602', code: 'KTM' }, { pincode: '44603', code: 'KTM' },
    { pincode: '44604', code: 'KTM' }, { pincode: '44605', code: 'KTM' },
    { pincode: '44606', code: 'KTM' }, { pincode: '44607', code: 'KTM' },
    { pincode: '44608', code: 'KTM' }, { pincode: '44700', code: 'KTM' }, // Lalitpur
    { pincode: '44701', code: 'KTM' }, { pincode: '44702', code: 'KTM' },
    { pincode: '44800', code: 'KTM' }, { pincode: '44801', code: 'KTM' }, // Bhaktapur
    // Pokhara (33700-33720)
    { pincode: '33700', code: 'PKR' }, { pincode: '33701', code: 'PKR' },
    { pincode: '33702', code: 'PKR' }, { pincode: '33703', code: 'PKR' },
    // Biratnagar (56700-56720)
    { pincode: '56700', code: 'BRT' }, { pincode: '56701', code: 'BRT' },
    { pincode: '56702', code: 'BRT' }, { pincode: '56703', code: 'BRT' },
    // Chitwan (44200-44220)
    { pincode: '44207', code: 'CTW' }, { pincode: '44208', code: 'CTW' },
    { pincode: '44209', code: 'CTW' }, { pincode: '44210', code: 'CTW' },
    // Butwal (32907-32920)
    { pincode: '32907', code: 'BTW' }, { pincode: '32908', code: 'BTW' },
    { pincode: '32909', code: 'BTW' },
    // Remote
    { pincode: '21000', code: 'REMOTE' }, { pincode: '33400', code: 'REMOTE' },
  ];

  for (const { pincode, code } of pincodes) {
    const zone = zoneByCode[code];
    if (zone) {
      await db.insert(schema.pincodeZoneMap)
        .values({ pincode, zoneId: zone.id, isActive: true })
        .onConflictDoNothing();
    }
  }
  console.log(`  ✓ ${pincodes.length} Nepal pincodes seeded`);
}

/**
 * Creates indexes that drizzle-orm 0.30.x's schema builder cannot express
 * in TypeScript (GiST/GIN access methods, expression indexes). Run once
 * after `drizzle-kit push`. All statements are idempotent (IF NOT EXISTS).
 */
async function seedSpecialIndexes(): Promise<void> {
  console.log('  Creating GiST/GIN/expression indexes...');

  // ltree subtree queries (categories.path <@ '...') — GiST is the only
  // index type Postgres supports for ltree's containment operators.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS categories_path_gist_idx
      ON categories USING GIST (path);
  `);

  // Full-text search on products.search_vector (tsvector @@ tsquery)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS products_search_vector_gin_idx
      ON products USING GIN (search_vector);
  `);

  // Low-stock lookups filter on (quantity_on_hand - quantity_reserved) <= low_stock_threshold.
  // An expression index lets Postgres use an index scan for this comparison
  // instead of a sequential scan, without storing a separate generated column.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS inventory_available_expr_idx
      ON inventory ((quantity_on_hand - quantity_reserved));
  `);

  console.log('  ✓ Special indexes created (categories GiST, products GIN, inventory expression)');
}
