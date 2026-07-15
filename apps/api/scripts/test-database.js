const { spawnSync } = require('node:child_process');
const value = process.env.DATABASE_URL_TEST;
if (!value || !/test/i.test(value) || /prod(uction)?/i.test(value) || value === process.env.DATABASE_URL) throw new Error('DATABASE_URL_TEST must identify a dedicated test database and differ from DATABASE_URL.');
const command = process.argv[2] === 'reset' ? ['migrate','reset','--force','--skip-generate'] : ['migrate','deploy'];
const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',['exec','prisma',...command],{stdio:'inherit',env:{...process.env,DATABASE_URL:value}});
process.exit(result.status ?? 1);
