// TKD / ITM Daily Price Scrape
// Scrapes Total Tools + Sydney Tools for all TKD brands, writes latest-prices.csv to repo

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const FIRECRAWL_KEY = process.env.FIRECRAWL_KEY;

// ─── URLs to scrape ───────────────────────────────────────────────────────────
// Strategy: scrape all brand pages for TT and ST.
// ITM on TT has 994 products so we use focused subcategory pages instead.
const URLS = [
  // ── Total Tools ──
  // Holemaker (AT / CB / CBC / SP / HMPRO prefixes)
  { supplier: 'Total Tools', brand: 'Holemaker',    url: 'https://www.totaltools.com.au/brands/holemaker' },
  // M7
  { supplier: 'Total Tools', brand: 'M7',           url: 'https://www.totaltools.com.au/brands/m7' },
  // ITM — split into subcategories to avoid 994-product monster page
  { supplier: 'Total Tools', brand: 'ITM',          url: 'https://www.totaltools.com.au/brands/itm/itm-hand-tools' },
  { supplier: 'Total Tools', brand: 'ITM',          url: 'https://www.totaltools.com.au/brands/itm/itm-power-tool-accessories' },
  { supplier: 'Total Tools', brand: 'ITM',          url: 'https://www.totaltools.com.au/brands/itm/itm-air-tools' },
  { supplier: 'Total Tools', brand: 'ITM',          url: 'https://www.totaltools.com.au/brands/itm/itm-automotive-tools' },
  { supplier: 'Total Tools', brand: 'ITM',          url: 'https://www.totaltools.com.au/brands/itm/itm-workshop-equipment' },
  { supplier: 'Total Tools', brand: 'ITM',          url: 'https://www.totaltools.com.au/brands/itm/itm-lifting-rigging-load-restraints' },
  // Smaller brands
  { supplier: 'Total Tools', brand: 'Drill Doctor', url: 'https://www.totaltools.com.au/brands/drill-doctor' },
  { supplier: 'Total Tools', brand: 'Ehoma',        url: 'https://www.totaltools.com.au/brands/ehoma' },
  { supplier: 'Total Tools', brand: 'Groz',         url: 'https://www.totaltools.com.au/brands/groz' },
  { supplier: 'Total Tools', brand: 'Star',         url: 'https://www.totaltools.com.au/brands/star' },
  { supplier: 'Total Tools', brand: 'Wiha',         url: 'https://www.totaltools.com.au/brands/wiha' },
  // NOTE: Rytool (RT-) and Teng (TE-) have no TT brand page — ST only

  // ── Sydney Tools ──
  // Holemaker subcategories
  { supplier: 'Sydney Tools', brand: 'Holemaker',    url: 'https://sydneytools.com.au/category/by-brand/holemaker/burrs' },
  { supplier: 'Sydney Tools', brand: 'Holemaker',    url: 'https://sydneytools.com.au/category/by-brand/holemaker/magnetic-metal-drills' },
  { supplier: 'Sydney Tools', brand: 'Holemaker',    url: 'https://sydneytools.com.au/category/by-brand/holemaker/annular-magnetic-drill-cutters-centering-pins' },
  { supplier: 'Sydney Tools', brand: 'Holemaker',    url: 'https://sydneytools.com.au/category/by-brand/holemaker/deburrers' },
  { supplier: 'Sydney Tools', brand: 'Holemaker',    url: 'https://sydneytools.com.au/category/by-brand/holemaker/drill-bits' },
  { supplier: 'Sydney Tools', brand: 'Holemaker',    url: 'https://sydneytools.com.au/category/by-brand/holemaker/mechanical-hand-tools-accessories' },
  // ITM subcategories on ST
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/vices' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/drill-presses' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/bottle-jacks' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/trolley-jacks' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/grab-hooks' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/welding-clamps' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/shackles' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/chain-blocks' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/load-binders' },
  { supplier: 'Sydney Tools', brand: 'ITM',          url: 'https://sydneytools.com.au/category/by-brand/itm/lifting-slings' },
  // Smaller brands on ST (including Rytool and Teng which aren't on TT)
  { supplier: 'Sydney Tools', brand: 'Drill Doctor', url: 'https://sydneytools.com.au/category/by-brand/drill-doctor' },
  { supplier: 'Sydney Tools', brand: 'Ehoma',        url: 'https://sydneytools.com.au/category/by-brand/ehoma' },
  { supplier: 'Sydney Tools', brand: 'Groz',         url: 'https://sydneytools.com.au/category/by-brand/groz' },
  { supplier: 'Sydney Tools', brand: 'Rytool',       url: 'https://sydneytools.com.au/category/by-brand/rytool' },
  { supplier: 'Sydney Tools', brand: 'Star',         url: 'https://sydneytools.com.au/category/by-brand/star' },
  { supplier: 'Sydney Tools', brand: 'Teng',         url: 'https://sydneytools.com.au/category/by-brand/teng' },
  { supplier: 'Sydney Tools', brand: 'Wiha',         url: 'https://sydneytools.com.au/category/by-brand/wiha' },
];

// ─── SKU normalisation ────────────────────────────────────────────────────────
// TKD CORE SKUS uses CBC- prefix for Holemaker carbide burrs.
// TT / ST list them as CB- (Holemaker brand page SKUs).
// Map scraper output → ITM master SKU so the CSV aligns with the master list.
const SKU_MAP = {
  // Carbide burr prefix: CB- on supplier sites → CBC- in ITM system
  // These are added dynamically below for efficiency.
  // Add any other one-off mismatches here, e.g.:
  // 'HMPRO35K1-ALT': 'HMPRO35K1',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function post(hostname, path_, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path: path_, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      res => { let raw = ''; res.on('data', c => raw += c); res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(e); } }); }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function normaliseSku(sku) {
  if (!sku) return sku;
  // Static map first
  if (SKU_MAP[sku]) return SKU_MAP[sku];
  // Dynamic rule: CB-xxx → CBC-xxx (Holemaker carbide burrs)
  // Holemaker carbide burr SKUs on supplier sites start with CB- but ITM master uses CBC-
  if (/^CB-/.test(sku)) return 'CBC-' + sku.slice(3);
  return sku;
}

function roundNickel(n) { return Math.round(n / 0.05) * 0.05; }

async function scrapeUrl(supplier, brand, url) {
  console.log(`  Scraping ${supplier} / ${brand}: ${url}`);
  try {
    const result = await post('api.firecrawl.dev', '/v1/scrape',
      { 'Authorization': `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
      {
        url,
        formats: ['extract'],
        extract: {
          prompt: `Extract all ${brand} brand products from this page. For each product return: product name, SKU/model number, price in AUD as a number only, and whether in stock. IMPORTANT: Copy the SKU/model number exactly as it appears on the page — do not abbreviate, guess, or modify it in any way. Every character matters including letters, numbers, and hyphens.`,
          schema: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product_name: { type: 'string' },
                    sku:          { type: 'string' },
                    price_aud:    { type: 'number' },
                    in_stock:     { type: 'boolean' }
                  },
                  required: ['product_name', 'sku', 'price_aud', 'in_stock']
                }
              }
            }
          }
        }
      }
    );
    const products = result?.data?.extract?.products || [];
    console.log(`    → ${products.length} products`);
    return products.map(p => ({
      supplier,
      sku:     normaliseSku(p.sku),
      name:    p.product_name,
      price:   p.price_aud,
      inStock: p.in_stock
    }));
  } catch(e) {
    console.error(`    FAILED: ${e.message}`);
    return [];
  }
}

function toCsv(rows) {
  const header = ['Date','SKU','Product Name','Total Tools Price','Total Tools Stock','Sydney Tools Price','Sydney Tools Stock','# Suppliers','Cheapest','Highest','Market Avg','ITM Match Price','Pricing Rule'];
  const escape = v => (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) ? `"${v.replace(/"/g,'""')}"` : v;
  return [header, ...rows].map(r => r.map(escape).join(',')).join('\n');
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n=== TKD / ITM Price Scrape: ${today} ===\n`);

  // Scrape all URLs
  let allRecords = [];
  for (const { supplier, brand, url } of URLS) {
    allRecords = allRecords.concat(await scrapeUrl(supplier, brand, url));
  }

  // Dedup per supplier+SKU (in case SKUs appear on multiple subcategory pages)
  const seen = new Set();
  const deduped = allRecords.filter(r => {
    const key = `${r.supplier}|${r.sku}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`\nUnique records: ${deduped.length}`);

  // Pivot by SKU
  const pivot = {};
  for (const r of deduped) {
    if (!pivot[r.sku]) pivot[r.sku] = { sku: r.sku, name: r.name, tt: 0, ttStock: '', st: 0, stStock: '' };
    if (r.name && r.name.length > (pivot[r.sku].name || '').length) pivot[r.sku].name = r.name;
    if (r.supplier === 'Total Tools')  { pivot[r.sku].tt = r.price; pivot[r.sku].ttStock = r.inStock ? 'Yes' : 'No'; }
    if (r.supplier === 'Sydney Tools') { pivot[r.sku].st = r.price; pivot[r.sku].stStock = r.inStock ? 'Yes' : 'No'; }
  }

  // Build CSV rows
  const r2 = v => Math.round(v * 100) / 100;
  const csvRows = [];
  for (const sku of Object.keys(pivot).sort()) {
    const p = pivot[sku];
    const prices   = [p.tt, p.st].filter(x => x > 0);
    const cheapest = prices.length ? Math.min(...prices) : '';
    const highest  = prices.length ? Math.max(...prices) : '';
    const avg      = prices.length ? Math.round(prices.reduce((a,b) => a+b,0) / prices.length * 100) / 100 : '';

    let matchPrice = '', note = '';
    if (p.tt > 0 && p.st > 0) {
      if (p.tt === p.st) { matchPrice = r2(roundNickel(p.tt));          note = `TT and ST same — matched at $${p.tt}`; }
      else               { matchPrice = r2(roundNickel((p.tt+p.st)/2)); note = `Midpoint TT $${p.tt} / ST $${p.st}`; }
    } else if (p.tt > 0) {
      matchPrice = r2(roundNickel(p.tt)); note = `Matched Total Tools $${p.tt} (ST not listed)`;
    } else if (p.st > 0) {
      matchPrice = r2(roundNickel(p.st)); note = `Matched Sydney Tools $${p.st} (TT not listed)`;
    } else {
      note = 'No competitor prices — set manually';
    }

    csvRows.push([today, sku, p.name, p.tt ? r2(p.tt) : '', p.ttStock, p.st ? r2(p.st) : '', p.stStock, prices.length, cheapest ? r2(cheapest) : '', highest ? r2(highest) : '', avg ? r2(avg) : '', matchPrice, note]);
  }

  // Write files
  const csv = toCsv(csvRows);
  fs.writeFileSync('latest-prices.csv', csv, 'utf8');
  fs.mkdirSync('history', { recursive: true });
  fs.writeFileSync(`history/${today}.csv`, csv, 'utf8');

  console.log(`Written: latest-prices.csv and history/${today}.csv (${csvRows.length} SKUs)`);
}

main().catch(e => { console.error(e); process.exit(1); });
