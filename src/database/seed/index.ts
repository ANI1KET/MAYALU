import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from '../schema/index';

dotenv.config();

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://mayalu:secret@localhost:5432/mayalu_wears',
});

const db = drizzle(pool, { schema });

// ─── Test / demo data ────────────────────────────────────────────
// Matches api-tests/mayalu-wears.postman_environment.json's `testPhone`.
// Lets you exercise every endpoint immediately after `pnpm db:seed` —
// login still requires a real OTP round-trip (read it from the server
// console; SMS_PROVIDER=mock), but every other prerequisite (shop,
// products, inventory, cart, orders, reviews...) already exists.
const OWNER_PHONE = '+9779800000001';
const CUSTOMER_PHONE = '+9779800000002';

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

async function seedTestCategoryAttributes(): Promise<void> {
  console.log('  Seeding category-attribute links...');

  const links = [
    { categorySlug: 'saree', attrCode: 'color', isVariant: false, isRequired: true },
    { categorySlug: 'saree', attrCode: 'size', isVariant: true, isRequired: true },
    { categorySlug: 'saree', attrCode: 'fabric', isVariant: false, isRequired: false },
    { categorySlug: 'kurti', attrCode: 'color', isVariant: false, isRequired: true },
    { categorySlug: 'kurti', attrCode: 'size', isVariant: true, isRequired: true },
    { categorySlug: 'mobiles', attrCode: 'brand', isVariant: false, isRequired: true },
    { categorySlug: 'mobiles', attrCode: 'storage', isVariant: true, isRequired: true },
    { categorySlug: 'mobiles', attrCode: 'ram', isVariant: false, isRequired: false },
  ];

  for (const link of links) {
    const category = await db.query.categories.findFirst({ where: (c, { eq: eqOp }) => eqOp(c.slug, link.categorySlug) });
    const attribute = await db.query.attributes.findFirst({ where: (a, { eq: eqOp }) => eqOp(a.code, link.attrCode) });
    if (category && attribute) {
      await db.insert(schema.categoryAttributes).values({
        categoryId: category.id,
        attributeId: attribute.id,
        isRequired: link.isRequired,
        isVariantAttribute: link.isVariant,
        sortOrder: 0,
      }).onConflictDoNothing();
    }
  }
  console.log('  ✓ Category-attribute links seeded');
}

async function seedTestUsers(): Promise<{
  owner: typeof schema.users.$inferSelect;
  customer: typeof schema.users.$inferSelect;
}> {
  console.log('  Seeding test users...');

  await db.insert(schema.users).values([
    {
      phone: OWNER_PHONE,
      fullName: 'Sita Rai (Test Shop Owner)',
      email: 'owner@test.mayaluwears.com',
      status: 'active',
      isPhoneVerified: true,
      isEmailVerified: true,
    },
    {
      phone: CUSTOMER_PHONE,
      fullName: 'Hari Thapa (Test Customer)',
      email: 'customer@test.mayaluwears.com',
      status: 'active',
      isPhoneVerified: true,
      isEmailVerified: true,
    },
  ]).onConflictDoNothing();

  const owner = await db.query.users.findFirst({ where: (u, { eq: eqOp }) => eqOp(u.phone, OWNER_PHONE) });
  const customer = await db.query.users.findFirst({ where: (u, { eq: eqOp }) => eqOp(u.phone, CUSTOMER_PHONE) });
  if (!owner || !customer) throw new Error('Failed to seed test users');

  console.log(`  ✓ Test users ready — owner: ${OWNER_PHONE}, customer: ${CUSTOMER_PHONE}`);
  return { owner, customer };
}

async function seedTestShop(ownerId: string): Promise<typeof schema.shops.$inferSelect> {
  console.log('  Seeding test shop...');

  let shop = await db.query.shops.findFirst({ where: (s, { eq: eqOp }) => eqOp(s.slug, 'mayalu-test-shop') });
  if (!shop) {
    const [created] = await db.insert(schema.shops).values({
      ownerUserId: ownerId,
      name: 'Mayalu Test Shop',
      slug: 'mayalu-test-shop',
      description: 'Seeded demo shop for manual & Postman API testing.',
      status: 'active',
      verificationStatus: 'verified',
      businessAddress: 'Thamel, Kathmandu',
      businessPhone: OWNER_PHONE,
    }).returning();
    shop = created!;
  }

  const growthPlan = await db.query.plans.findFirst({ where: (p, { eq: eqOp }) => eqOp(p.slug, 'growth') });
  if (growthPlan) {
    const existingSub = await db.query.shopSubscriptions.findFirst({ where: (s, { eq: eqOp }) => eqOp(s.shopId, shop.id) });
    if (!existingSub) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      await db.insert(schema.shopSubscriptions).values({
        shopId: shop.id,
        planId: growthPlan.id,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        planFeaturesSnapshot: {
          maxProducts: growthPlan.maxProducts,
          maxVariantsPerProduct: growthPlan.maxVariantsPerProduct,
          maxImagesPerProduct: growthPlan.maxImagesPerProduct,
          maxWarehouses: growthPlan.maxWarehouses,
          maxStaffMembers: growthPlan.maxStaffMembers,
          storageGb: growthPlan.storageGb,
          canUseCod: growthPlan.canUseCod,
          canUseEsewa: growthPlan.canUseEsewa,
          canUseDiscounts: growthPlan.canUseDiscounts,
          canUseAnalytics: growthPlan.canUseAnalytics,
          commissionRate: growthPlan.commissionRate,
        },
      });
    }
  }

  await db.insert(schema.shopMembers).values({
    shopId: shop.id,
    userId: ownerId,
    role: 'owner',
    acceptedAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(schema.shopResourceUsage).values({
    shopId: shop.id,
    totalStaffMembers: 1,
  }).onConflictDoNothing();

  console.log(`  ✓ Test shop ready — slug: ${shop.slug} (Growth plan, active)`);
  return shop;
}

async function seedOwnerAddress(ownerId: string): Promise<typeof schema.addresses.$inferSelect> {
  let address = await db.query.addresses.findFirst({
    where: (a, { and, eq: eqOp }) => and(eqOp(a.userId, ownerId), eqOp(a.type, 'work')),
  });
  if (!address) {
    const [created] = await db.insert(schema.addresses).values({
      userId: ownerId,
      type: 'work',
      fullName: 'Sita Rai',
      phone: OWNER_PHONE,
      addressLine: 'Thamel Marg, Shop No. 12',
      landmark: 'Near Kathmandu Guest House',
      city: 'Kathmandu',
      district: 'Kathmandu',
      pincode: '44600',
      zone: 'inside_valley',
      isDefault: true,
    }).returning();
    address = created!;
  }
  return address;
}

async function seedTestWarehouse(shopId: string, addressId: string): Promise<typeof schema.warehouses.$inferSelect> {
  let warehouse = await db.query.warehouses.findFirst({ where: (w, { eq: eqOp }) => eqOp(w.shopId, shopId) });
  if (!warehouse) {
    const [created] = await db.insert(schema.warehouses).values({
      shopId,
      name: 'Main Warehouse - Thamel',
      addressId,
      isActive: true,
      isDefault: true,
    }).returning();
    warehouse = created!;
  }
  console.log('  ✓ Test warehouse ready');
  return warehouse;
}

interface CatalogVariant { id: string; sku: string; name: string; price: string }
interface CatalogEntry { productId: string; name: string; variants: CatalogVariant[] }
interface Catalog { saree: CatalogEntry; kurti: CatalogEntry; phone: CatalogEntry }

async function seedTestProducts(shopId: string, warehouseId: string): Promise<Catalog> {
  console.log('  Seeding test products, variants, media & inventory...');

  async function attrOption(code: string, value: string): Promise<{ attributeId: string; optionId: string } | null> {
    const attr = await db.query.attributes.findFirst({ where: (a, { eq: eqOp }) => eqOp(a.code, code) });
    if (!attr) return null;
    const option = await db.query.attributeOptions.findFirst({
      where: (o, { and, eq: eqOp }) => and(eqOp(o.attributeId, attr.id), eqOp(o.value, value)),
    });
    if (!option) return null;
    return { attributeId: attr.id, optionId: option.id };
  }

  async function buildEntry(spec: {
    slug: string;
    name: string;
    shortDescription: string;
    categorySlug: string;
    productAttrs: { code: string; value: string }[];
    variants: { sku: string; name: string; price: string; attr: { code: string; value: string } }[];
    imageSeed: string;
  }): Promise<CatalogEntry> {
    const category = await db.query.categories.findFirst({ where: (c, { eq: eqOp }) => eqOp(c.slug, spec.categorySlug) });

    let product = await db.query.products.findFirst({
      where: (p, { and, eq: eqOp }) => and(eqOp(p.shopId, shopId), eqOp(p.slug, spec.slug)),
    });
    if (!product) {
      const [created] = await db.insert(schema.products).values({
        shopId,
        categoryId: category?.id,
        name: spec.name,
        slug: spec.slug,
        shortDescription: spec.shortDescription,
        status: 'active',
        publishedAt: new Date(),
      }).returning();
      product = created!;
    }

    for (const pa of spec.productAttrs) {
      const found = await attrOption(pa.code, pa.value);
      if (found) {
        await db.insert(schema.productAttributeValues).values({
          productId: product.id,
          attributeId: found.attributeId,
          attributeOptionId: found.optionId,
        }).onConflictDoNothing();
      }
    }

    const variants: CatalogVariant[] = [];
    for (let i = 0; i < spec.variants.length; i++) {
      const v = spec.variants[i]!;
      let variant = await db.query.productVariants.findFirst({ where: (pv, { eq: eqOp }) => eqOp(pv.sku, v.sku) });
      if (!variant) {
        const [created] = await db.insert(schema.productVariants).values({
          productId: product.id,
          sku: v.sku,
          name: v.name,
          price: v.price,
          isActive: true,
          sortOrder: i,
        }).returning();
        variant = created!;
      }

      const found = await attrOption(v.attr.code, v.attr.value);
      if (found) {
        await db.insert(schema.variantAttributeValues).values({
          variantId: variant.id,
          attributeId: found.attributeId,
          attributeOptionId: found.optionId,
        }).onConflictDoNothing();
      }

      await db.insert(schema.inventory).values({
        variantId: variant.id,
        warehouseId,
        quantityOnHand: 50,
        quantityReserved: 0,
        lowStockThreshold: 5,
      }).onConflictDoNothing();

      variants.push({ id: variant.id, sku: variant.sku, name: variant.name, price: variant.price });
    }

    const existingMedia = await db.query.productMedia.findFirst({ where: (m, { eq: eqOp }) => eqOp(m.productId, product.id) });
    if (!existingMedia) {
      const imageUrl = `https://picsum.photos/seed/${spec.imageSeed}/800/800`;
      await db.insert(schema.productMedia).values({
        productId: product.id,
        url: imageUrl,
        publicId: `seed/${spec.imageSeed}`,
        type: 'image',
        isPrimary: true,
        sortOrder: 0,
      });
      await db.update(schema.products)
        .set({ primaryImageUrl: imageUrl, updatedAt: new Date() })
        .where(eq(schema.products.id, product.id));
    }

    // Mirrors ProductsService.createVariant()'s denormalized price-stat recompute.
    await pool.query(
      `UPDATE products SET
         min_price_npr = (SELECT MIN(price) FROM product_variants WHERE product_id = $1 AND is_active = true),
         max_price_npr = (SELECT MAX(price) FROM product_variants WHERE product_id = $1 AND is_active = true),
         active_variant_count = (SELECT COUNT(*) FROM product_variants WHERE product_id = $1 AND is_active = true),
         updated_at = NOW()
       WHERE id = $1`,
      [product.id],
    );

    return { productId: product.id, name: spec.name, variants };
  }

  const saree = await buildEntry({
    slug: 'nepali-silk-saree-red-seed',
    name: 'Nepali Silk Saree - Red',
    shortDescription: 'Handwoven silk saree with zari border — perfect for festive occasions.',
    categorySlug: 'saree',
    productAttrs: [{ code: 'color', value: 'red' }, { code: 'fabric', value: 'silk' }],
    variants: [
      { sku: 'MW-SEED-SAREE-RED-M', name: 'Red - M', price: '2499.00', attr: { code: 'size', value: 'm' } },
      { sku: 'MW-SEED-SAREE-RED-L', name: 'Red - L', price: '2499.00', attr: { code: 'size', value: 'l' } },
    ],
    imageSeed: 'mw-saree-red',
  });

  const kurti = await buildEntry({
    slug: 'cotton-kurti-blue-seed',
    name: 'Cotton Kurti - Blue',
    shortDescription: 'Everyday comfort cotton kurti, breathable and lightweight.',
    categorySlug: 'kurti',
    productAttrs: [{ code: 'color', value: 'blue' }, { code: 'fabric', value: 'cotton' }],
    variants: [
      { sku: 'MW-SEED-KURTI-BLUE-S', name: 'Blue - S', price: '899.00', attr: { code: 'size', value: 's' } },
      { sku: 'MW-SEED-KURTI-BLUE-M', name: 'Blue - M', price: '899.00', attr: { code: 'size', value: 'm' } },
    ],
    imageSeed: 'mw-kurti-blue',
  });

  const phone = await buildEntry({
    slug: 'samsung-galaxy-a54-seed',
    name: 'Samsung Galaxy A54 Smartphone',
    shortDescription: 'Samsung Galaxy A54, 5G-ready with a 6.4" Super AMOLED display.',
    categorySlug: 'mobiles',
    productAttrs: [{ code: 'brand', value: 'samsung' }, { code: 'ram', value: '8gb' }],
    variants: [
      { sku: 'MW-SEED-PHONE-128GB', name: '128GB', price: '42999.00', attr: { code: 'storage', value: '128gb' } },
      { sku: 'MW-SEED-PHONE-256GB', name: '256GB', price: '47999.00', attr: { code: 'storage', value: '256gb' } },
    ],
    imageSeed: 'mw-phone-a54',
  });

  console.log('  ✓ 3 test products (6 variants) seeded with media & inventory (50 units/variant)');
  return { saree, kurti, phone };
}

async function seedTestCoupons(shopId: string): Promise<{ welcomeId: string }> {
  console.log('  Seeding test coupons...');

  await db.insert(schema.coupons).values([
    {
      shopId: null,
      code: 'WELCOME10',
      description: 'Platform-wide welcome offer — 10% off, max NPR 500',
      discountType: 'percentage',
      discountValue: '10',
      minOrderAmount: '500',
      maxDiscount: '500',
      usageLimitPerUser: 1,
      isActive: true,
    },
    {
      shopId,
      code: 'SHOPTEST20',
      description: 'Shop-specific test coupon — flat NPR 200 off, min order NPR 1000',
      discountType: 'fixed',
      discountValue: '200',
      minOrderAmount: '1000',
      usageLimitPerUser: 1,
      isActive: true,
    },
  ]).onConflictDoNothing();

  const welcome = await db.query.coupons.findFirst({ where: (c, { eq: eqOp }) => eqOp(c.code, 'WELCOME10') });
  if (!welcome) throw new Error('Failed to seed test coupons');

  console.log('  ✓ Coupons seeded — WELCOME10 (platform-wide), SHOPTEST20 (shop-specific, unused — good for a fresh validate test)');
  return { welcomeId: welcome.id };
}

async function seedTestBanner(): Promise<void> {
  const existing = await db.query.banners.findFirst({ where: (b, { eq: eqOp }) => eqOp(b.title, 'Dashain Mega Sale') });
  if (existing) return;

  await db.insert(schema.banners).values({
    shopId: null,
    title: 'Dashain Mega Sale',
    imageUrl: 'https://picsum.photos/seed/mw-banner-dashain/1200/400',
    publicId: 'seed/banners/dashain',
    linkUrl: '/products',
    position: 'hero',
    isActive: true,
    sortOrder: 0,
  });
  console.log('  ✓ Test banner seeded');
}

async function seedCustomerAddress(customerId: string): Promise<typeof schema.addresses.$inferSelect> {
  let address = await db.query.addresses.findFirst({ where: (a, { eq: eqOp }) => eqOp(a.userId, customerId) });
  if (!address) {
    const [created] = await db.insert(schema.addresses).values({
      userId: customerId,
      type: 'home',
      fullName: 'Hari Thapa',
      phone: CUSTOMER_PHONE,
      addressLine: 'Boudha, House 45',
      landmark: 'Near Boudhanath Stupa',
      city: 'Kathmandu',
      district: 'Kathmandu',
      pincode: '44600',
      zone: 'inside_valley',
      isDefault: true,
    }).returning();
    address = created!;
  }
  console.log('  ✓ Customer delivery address ready');
  return address;
}

async function seedCustomerWishlistAndCart(customerId: string, catalog: Catalog): Promise<void> {
  console.log('  Seeding customer wishlist & cart...');

  let wishlist = await db.query.wishlists.findFirst({ where: (w, { eq: eqOp }) => eqOp(w.userId, customerId) });
  if (!wishlist) {
    const [created] = await db.insert(schema.wishlists).values({ userId: customerId }).returning();
    wishlist = created!;
  }
  await db.insert(schema.wishlistItems).values({
    wishlistId: wishlist.id,
    productId: catalog.saree.productId,
  }).onConflictDoNothing();

  let cart = await db.query.carts.findFirst({ where: (c, { eq: eqOp }) => eqOp(c.userId, customerId) });
  if (!cart) {
    const [created] = await db.insert(schema.carts).values({ userId: customerId }).returning();
    cart = created!;
  }
  const phone256 = catalog.phone.variants[1]!;
  await db.insert(schema.cartItems).values({
    cartId: cart.id,
    variantId: phone256.id,
    quantity: 1,
    priceSnapshot: phone256.price,
  }).onConflictDoNothing();

  console.log('  ✓ Wishlist (saree) & cart (phone 256GB) seeded for customer');
}

async function seedTestOrders(
  customerId: string,
  address: typeof schema.addresses.$inferSelect,
  shopId: string,
  catalog: Catalog,
  welcomeCouponId: string,
): Promise<{ phoneOrderId: string; kurtiReviewedOrderId: string }> {
  console.log('  Seeding test orders...');

  const addressSnap = {
    fullName: address.fullName,
    phone: address.phone,
    addressLine: address.addressLine,
    landmark: address.landmark,
    city: address.city,
    district: address.district,
    pincode: address.pincode,
    zone: address.zone,
  };

  async function upsertOrder(
    orderNumber: string,
    status: 'pending' | 'delivered',
    items: { variant: CatalogVariant; productName: string; qty: number }[],
    opts?: { couponId?: string; couponCode?: string; discount?: number },
  ): Promise<string> {
    const existing = await db.query.orders.findFirst({ where: (o, { eq: eqOp }) => eqOp(o.orderNumber, orderNumber) });
    if (existing) return existing.id;

    const subtotal = items.reduce((sum, it) => sum + parseFloat(it.variant.price) * it.qty, 0);
    const discount = opts?.discount ?? 0;
    const total = subtotal - discount; // deliveryCharge = 0 for inside_valley

    const [order] = await db.insert(schema.orders).values({
      orderNumber,
      userId: customerId,
      status,
      paymentMethod: 'cod',
      paymentStatus: status === 'delivered' ? 'paid' : 'pending',
      subtotal: subtotal.toFixed(2),
      discountAmount: discount.toFixed(2),
      deliveryCharge: '0.00',
      totalAmount: total.toFixed(2),
      couponId: opts?.couponId ?? null,
      couponCode: opts?.couponCode ?? null,
      shippingAddressSnap: addressSnap,
      estimatedDelivery: '5-7 business days',
      deliveryZone: address.zone,
      confirmedAt: new Date(),
      packedAt: status === 'delivered' ? new Date() : null,
      shippedAt: status === 'delivered' ? new Date() : null,
      deliveredAt: status === 'delivered' ? new Date() : null,
    }).returning();
    const orderId = order!.id;

    for (const it of items) {
      await db.insert(schema.orderItems).values({
        orderId,
        shopId,
        variantId: it.variant.id,
        productNameSnap: it.productName,
        variantNameSnap: it.variant.name,
        skuSnap: it.variant.sku,
        imageUrlSnap: null,
        priceSnap: it.variant.price,
        quantity: it.qty,
        totalPrice: (parseFloat(it.variant.price) * it.qty).toFixed(2),
      });
    }

    await db.insert(schema.orderStatusHistory).values({ orderId, fromStatus: null, toStatus: 'pending', changedAt: new Date() });
    if (status === 'delivered') {
      await db.insert(schema.orderStatusHistory).values({ orderId, fromStatus: 'pending', toStatus: 'delivered', changedAt: new Date() });
    }

    if (opts?.couponId) {
      await pool.query(`UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1`, [opts.couponId]);
      await db.insert(schema.couponUsages).values({
        couponId: opts.couponId,
        userId: customerId,
        orderId,
        amountSaved: discount.toFixed(2),
      });
    }

    return orderId;
  }

  const sareeM = catalog.saree.variants[0]!;
  const kurtiS = catalog.kurti.variants[0]!;
  const kurtiM = catalog.kurti.variants[1]!;
  const phone128 = catalog.phone.variants[0]!;

  const welcomeDiscount = Math.min(parseFloat(sareeM.price) * 0.1, 500);

  await upsertOrder(
    'MW-SEED-0001', 'delivered',
    [{ variant: sareeM, productName: catalog.saree.name, qty: 1 }],
    { couponId: welcomeCouponId, couponCode: 'WELCOME10', discount: welcomeDiscount },
  );

  await upsertOrder(
    'MW-SEED-0002', 'pending',
    [{ variant: kurtiS, productName: catalog.kurti.name, qty: 1 }],
  );

  const phoneOrderId = await upsertOrder(
    'MW-SEED-0003', 'delivered',
    [{ variant: phone128, productName: catalog.phone.name, qty: 1 }],
  );

  const kurtiReviewedOrderId = await upsertOrder(
    'MW-SEED-0004', 'delivered',
    [{ variant: kurtiM, productName: catalog.kurti.name, qty: 2 }],
  );

  console.log('  ✓ Test orders seeded (MW-SEED-0001..0004)');
  return { phoneOrderId, kurtiReviewedOrderId };
}

async function seedTestReviews(
  shopId: string,
  catalog: Catalog,
  customerId: string,
  phoneOrderId: string,
  kurtiReviewedOrderId: string,
): Promise<void> {
  console.log('  Seeding test reviews...');

  async function upsertReview(
    orderId: string,
    productId: string,
    rating: number,
    comment: string,
    status: 'pending' | 'approved',
  ): Promise<void> {
    const existing = await db.query.reviews.findFirst({ where: (r, { eq: eqOp }) => eqOp(r.orderId, orderId) });
    if (existing) return;
    await db.insert(schema.reviews).values({
      productId, shopId, userId: customerId, orderId, rating, comment, isVerifiedPurchase: true, status,
    });
  }

  await upsertReview(phoneOrderId, catalog.phone.productId, 5, 'Great phone, battery lasts all day!', 'approved');
  await upsertReview(kurtiReviewedOrderId, catalog.kurti.productId, 4, 'Nice fabric, sizing runs slightly small.', 'pending');

  // Mirrors ReviewsService/AdminService's avgRating/totalReviews recompute (approved reviews only).
  await pool.query(
    `UPDATE products SET
       avg_rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE product_id = $1 AND status = 'approved'), 0),
       total_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND status = 'approved')
     WHERE id = $1`,
    [catalog.phone.productId],
  );

  console.log('  ✓ Test reviews seeded (1 approved on the phone, 1 pending on the kurti — for admin moderation testing)');
}

async function seedTestNotifications(customerId: string): Promise<void> {
  const existing = await db.query.notifications.findFirst({ where: (n, { eq: eqOp }) => eqOp(n.userId, customerId) });
  if (existing) return;

  await db.insert(schema.notifications).values([
    {
      userId: customerId,
      type: 'order_update',
      title: 'Order Delivered',
      body: 'Your order MW-SEED-0003 has been delivered. Enjoy!',
      isRead: true,
      readAt: new Date(),
    },
    {
      userId: customerId,
      type: 'promo',
      title: 'Welcome Offer',
      body: 'Use code WELCOME10 for 10% off your first order.',
      isRead: false,
    },
  ]);
  console.log('  ✓ Test notifications seeded (1 read, 1 unread)');
}

async function finalizeShopResourceUsage(shopId: string): Promise<void> {
  await pool.query(
    `UPDATE shop_resource_usage SET
       total_products = (SELECT COUNT(*) FROM products WHERE shop_id = $1),
       total_active_products = (SELECT COUNT(*) FROM products WHERE shop_id = $1 AND status = 'active'),
       total_variants = (SELECT COUNT(*) FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.shop_id = $1),
       updated_at = NOW()
     WHERE shop_id = $1`,
    [shopId],
  );
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

    console.log('🧪 Seeding test/demo data (so every endpoint has real data to hit)...');
    await seedTestCategoryAttributes();
    const { owner, customer } = await seedTestUsers();
    const shop = await seedTestShop(owner.id);
    const ownerAddress = await seedOwnerAddress(owner.id);
    const warehouse = await seedTestWarehouse(shop.id, ownerAddress.id);
    const catalog = await seedTestProducts(shop.id, warehouse.id);
    const { welcomeId } = await seedTestCoupons(shop.id);
    await seedTestBanner();
    const customerAddress = await seedCustomerAddress(customer.id);
    await seedCustomerWishlistAndCart(customer.id, catalog);
    const { phoneOrderId, kurtiReviewedOrderId } = await seedTestOrders(customer.id, customerAddress, shop.id, catalog, welcomeId);
    await seedTestReviews(shop.id, catalog, customer.id, phoneOrderId, kurtiReviewedOrderId);
    await seedTestNotifications(customer.id);
    await finalizeShopResourceUsage(shop.id);

    console.log('✅ Seed complete!');
    console.log('');
    console.log('──────────────────────────────────────────────────────────');
    console.log(' Ready-to-test accounts & data:');
    console.log(`   Shop owner phone : ${OWNER_PHONE}  (owns "mayalu-test-shop")`);
    console.log(`   Customer phone   : ${CUSTOMER_PHONE}  (has address, cart, wishlist, 4 orders)`);
    console.log('   Login: POST /auth/otp/send then /auth/otp/verify — OTP prints to the server console (SMS_PROVIDER=mock)');
    console.log('   Admin routes: header "X-Admin-Key: <ADMIN_SECRET_KEY from .env>"');
    console.log('   Products: nepali-silk-saree-red-seed, cotton-kurti-blue-seed, samsung-galaxy-a54-seed');
    console.log('   Coupons: WELCOME10 (already used by the customer — test the "already used" error), SHOPTEST20 (unused)');
    console.log('   Orders: MW-SEED-0001 (delivered, unreviewed — test POST review), MW-SEED-0002 (pending — test admin status update),');
    console.log('           MW-SEED-0003 (delivered, has an approved review), MW-SEED-0004 (delivered, has a pending review — test admin moderation)');
    console.log('──────────────────────────────────────────────────────────');
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
