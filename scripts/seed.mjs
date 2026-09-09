/**
 * Creates a sensible starting set of alert rules.
 * Safe to re-run: it skips any index that already has a rule.
 *
 *   npm run seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULTS = [
  { symbol: "^NSEI", label: "Nifty 50", thresholdPct: 1 },
  { symbol: "^NSEBANK", label: "Nifty Bank", thresholdPct: 1 },
  { symbol: "^BSESN", label: "S&P BSE Sensex", thresholdPct: 1 },
  { symbol: "^CNXIT", label: "Nifty IT", thresholdPct: 1.5 },
  { symbol: "^NSMIDCP", label: "Nifty Next 50", thresholdPct: 1.5 },
];

async function main() {
  await prisma.setting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  let created = 0;
  for (const d of DEFAULTS) {
    const existing = await prisma.alertRule.findFirst({ where: { symbol: d.symbol } });
    if (existing) {
      console.log(`skip   ${d.label} — rule already exists`);
      continue;
    }
    await prisma.alertRule.create({
      data: {
        symbol: d.symbol,
        label: d.label,
        direction: "down",
        thresholdPct: d.thresholdPct,
        basis: "prevClose",
        cooldownMinutes: 120,
        channels: "telegram,email,inapp",
      },
    });
    console.log(`create ${d.label} — alert when it falls ${d.thresholdPct}%`);
    created++;
  }

  console.log(`\nDone. ${created} rule(s) created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
