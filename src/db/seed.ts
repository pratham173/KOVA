import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { categories, products, users } from './schema.ts';
import { hashPassword } from '../server/paymentCrypto.ts';

const HERO_IMAGE = '/src/assets/images/hero_kova_collection_1795282144091.jpg';

const SEED_CATEGORIES = [
  {
    name: 'Lighting',
    slug: 'lighting',
    description: 'Sculptural spun-metal and opal-glass desk and ambient lamps.',
    sortOrder: 1,
  },
  {
    name: 'Tableware',
    slug: 'tableware',
    description: 'Hand-cast speckled stoneware carafes, cups, and daily vessels.',
    sortOrder: 2,
  },
  {
    name: 'Desk Objects',
    slug: 'desk-objects',
    description: 'Milled aluminum catchalls, solid brass instruments, and weighted tools.',
    sortOrder: 3,
  },
  {
    name: 'Carry & Soft',
    slug: 'carry-soft',
    description: 'Heavyweight unbleached canvas totes and loom-woven wool-cotton textiles.',
    sortOrder: 4,
  },
];

const SEED_PRODUCTS = [
  {
    categorySlug: 'lighting',
    name: 'Arc Desk Lamp',
    slug: 'arc-desk-lamp',
    sku: 'KV-LGT-01',
    summary: 'Spun-aluminum matte dome shade on a powder-coated charcoal steel column.',
    description:
      'Designed around a generous hemispherical reflector that casts soft, glare-free pools across a work surface. Spun from 2mm aluminum in a tactile chalk-stone finish and anchored by a weighted matte charcoal steel base with braided textile cord and inline dimmer.',
    priceMinor: 680000,
    stock: 14,
    images: [
      '/src/assets/images/product_arc_lamp_1795282162126.jpg',
      HERO_IMAGE,
    ],
    materials: 'Spun aluminum, powder-coated steel, braided linen cord',
    dimensions: 'Ø 28 cm × H 41 cm · 2.4 kg',
    isVisible: true,
    isFeatured: true,
  },
  {
    categorySlug: 'tableware',
    name: 'Fluted Stoneware Carafe',
    slug: 'fluted-stoneware-carafe',
    sku: 'KV-TBL-01',
    summary: 'Architectural ribbed porcelain water vessel finished in satin oatmeal glaze.',
    description:
      'Slip-cast in small studio runs with crisp vertical fluting for an effortless grip even when chilled. Fired to vitrification at 1240°C with an iron-flecked matte exterior and food-safe clear satin interior glaze. Holds 1.1 liters.',
    priceMinor: 295000,
    stock: 22,
    images: [
      '/src/assets/images/product_stoneware_carafe_1795282144095.jpg',
      HERO_IMAGE,
    ],
    materials: 'High-fired speckled stoneware clay, lead-free mineral glaze',
    dimensions: 'Ø 11.5 cm × H 25 cm · 1.1 L capacity',
    isVisible: true,
    isFeatured: true,
  },
  {
    categorySlug: 'desk-objects',
    name: 'Monolith Valet Tray',
    slug: 'monolith-valet-tray',
    sku: 'KV-DSK-01',
    summary: 'CNC-milled solid 6061 aluminum organizer in bead-blasted matte charcoal.',
    description:
      'Carved from a single billet of aerospace aluminum with four sculpted pockets sized for watches, keys, fountain pens, and daily clips. Subtle concentric toolpaths catch ambient light while a recessed cork foot protects timber and stone desktops.',
    priceMinor: 240000,
    stock: 18,
    images: [
      '/src/assets/images/product_monolith_tray_1795282143935.jpg',
      HERO_IMAGE,
    ],
    materials: 'Bead-blasted 6061-T6 anodized aluminum, natural Portuguese cork base',
    dimensions: '24 cm × 16 cm × 2.2 cm · 680 g',
    isVisible: true,
    isFeatured: true,
  },
  {
    categorySlug: 'tableware',
    name: 'Stacking Espresso Duo',
    slug: 'stacking-espresso-duo',
    sku: 'KV-TBL-02',
    summary: 'Pair of thick-walled speckled stoneware espresso cups with raw basalt foot.',
    description:
      'Engineered to retain heat and nest cleanly on an espresso machine warmer tray. Each cup pairs our warm speckled glaze above an unglazed raw charcoal stoneware base for tactile contrast in the hand.',
    priceMinor: 185000,
    stock: 30,
    images: [
      '/src/assets/images/product_espresso_duo_1795282144243.jpg',
      '/src/assets/images/product_stoneware_carafe_1795282144095.jpg',
    ],
    materials: 'Dual-clay speckled stoneware, dishwasher and microwave safe',
    dimensions: 'Ø 6.8 cm × H 6.2 cm · 110 ml each (set of 2)',
    isVisible: true,
    isFeatured: false,
  },
  {
    categorySlug: 'lighting',
    name: 'Orb Ambient Table Lamp',
    slug: 'orb-ambient-table-lamp',
    sku: 'KV-LGT-02',
    summary: 'Mouth-blown frosted opal glass globe seated on raw cleft basalt stone.',
    description:
      'Balances luminous lightness against geological weight. A triple-layer acid-etched glass diffuser rests flush inside a hand-turned dark basalt cylinder, radiating warm 2700K ambient light for bedside tables, bookshelves, and quiet corners.',
    priceMinor: 540000,
    stock: 9,
    images: [
      '/src/assets/images/product_orb_lamp_1795282144335.jpg',
      '/src/assets/images/product_arc_lamp_1795282162126.jpg',
    ],
    materials: 'Mouth-blown opal glass, natural carved basalt stone, 2700K LED bulb included',
    dimensions: 'Ø 18 cm × H 24 cm · 3.1 kg',
    isVisible: true,
    isFeatured: true,
  },
  {
    categorySlug: 'carry-soft',
    name: 'Studio Heavy Canvas Tote',
    slug: 'studio-heavy-canvas-tote',
    sku: 'KV-CRY-01',
    summary: 'Structured 18oz unbleached cotton duck carryall with dual-drop charcoal webbing.',
    description:
      'Built to stand upright on its own while loading laptops, sketchbooks, or studio samples. Sewn from raw Japanese-weight 18oz cotton canvas with reinforced boxed bottom, interior suspended 16-inch sleeve, and continuous charcoal cotton straps.',
    priceMinor: 320000,
    stock: 16,
    images: [
      '/src/assets/images/product_canvas_tote_1795282144104.jpg',
      '/src/assets/images/product_woven_throw_1795282143744.jpg',
    ],
    materials: '18oz unbleached cotton duck, 38mm heavy cotton webbing, brass rivets',
    dimensions: '42 cm × 34 cm × 16 cm · 22 L volume',
    isVisible: true,
    isFeatured: false,
  },
  {
    categorySlug: 'desk-objects',
    name: 'Weighted Brass Pen & Rest',
    slug: 'weighted-brass-pen-rest',
    sku: 'KV-DSK-02',
    summary: 'Precision-turned uncoated solid brass rollerball with angled charcoal stone plinth.',
    description:
      'Machined from solid C36000 brass rod that deepens into a personal patina over years of daily writing. Balanced forward for effortless strokes and docked at 45 degrees inside a chamfered dark stone block. Accepts standard Schmidt P8126 refills.',
    priceMinor: 365000,
    stock: 11,
    images: [
      '/src/assets/images/product_brass_pen_1795282144045.jpg',
      '/src/assets/images/product_monolith_tray_1795282143935.jpg',
    ],
    materials: 'Uncoated solid C36000 brass, honed dark limestone stand',
    dimensions: 'Pen 13.8 cm (58 g) · Stand 7.5 cm × 5 cm × 5.2 cm',
    isVisible: true,
    isFeatured: false,
  },
  {
    categorySlug: 'carry-soft',
    name: 'Woven Ribbed Throw',
    slug: 'woven-ribbed-throw',
    sku: 'KV-CRY-02',
    summary: 'Heavyweight cotton-merino ribbed blanket with architectural charcoal grid lines.',
    description:
      'Loom-knitted in a lofty fisherman rib that drapes with reassuring weight without overheating. Yarn-dyed in raw stone oat and deep obsidian stripes for an understated graphic accent across sofas and reading chairs.',
    priceMinor: 490000,
    stock: 7,
    images: [
      '/src/assets/images/product_woven_throw_1795282143744.jpg',
      '/src/assets/images/product_canvas_tote_1795282144104.jpg',
    ],
    materials: '70% combed organic cotton, 30% extrafine merino wool',
    dimensions: '140 cm × 190 cm · 1.35 kg',
    isVisible: true,
    isFeatured: false,
  },
];

let seedPromise: Promise<void> | null = null;

async function runSeedInternal(): Promise<void> {
  // Seed default demo admin and customer accounts idempotently
  const adminEmail = 'admin@kovagoods.com';
  const customerEmail = 'maya@example.com';

  await db
    .insert(users)
    .values([
      {
        uid: 'local_seed_admin_kova',
        email: adminEmail,
        name: 'KOVA Studio Admin',
        passwordHash: hashPassword('AdminDemo123!'),
        role: 'admin',
        authProvider: 'email',
      },
      {
        uid: 'local_seed_customer_maya',
        email: customerEmail,
        name: 'Maya Deshmukh',
        passwordHash: hashPassword('CustomerDemo123!'),
        role: 'customer',
        authProvider: 'email',
      },
    ])
    .onConflictDoNothing();

  // Only seed categories and products if catalogue is currently empty
  const [{ value: catCount }] = await db.select({ value: count() }).from(categories);
  if (Number(catCount) === 0) {
    for (const cat of SEED_CATEGORIES) {
      await db.insert(categories).values(cat).onConflictDoNothing();
    }
  }

  const [{ value: prodCount }] = await db.select({ value: count() }).from(products);
  if (Number(prodCount) === 0) {
    const allCats = await db.select().from(categories);
    const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));

    for (const item of SEED_PRODUCTS) {
      await db
        .insert(products)
        .values({
          categoryId: catBySlug.get(item.categorySlug) ?? null,
          name: item.name,
          slug: item.slug,
          sku: item.sku,
          summary: item.summary,
          description: item.description,
          priceMinor: item.priceMinor,
          currency: 'INR',
          stock: item.stock,
          images: item.images,
          materials: item.materials,
          dimensions: item.dimensions,
          isVisible: item.isVisible,
          isFeatured: item.isFeatured,
        })
        .onConflictDoNothing();
    }
  }
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeedInternal().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

export function getAdminEmailAllowlist(): Set<string> {
  const configured = (process.env.ADMIN_EMAILS || 'pratham28may2007@gmail.com,admin@kovagoods.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured);
}

export async function getUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}
