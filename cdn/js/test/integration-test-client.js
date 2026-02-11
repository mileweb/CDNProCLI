/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { CDNProClient } = require('../CDNProClient');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function loadServerInfo(args) {
  // 1) JSON file (supports either {host,user,secretKey} or {cdnPro:{...}} style)
  if (args.cred) {
    const p = path.resolve(process.cwd(), args.cred);
    const txt = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(txt);
    if (json.host && json.user && json.secretKey) return json;
    if (json.cdnPro && json.cdnPro.host && json.cdnPro.user && json.cdnPro.secretKey) return json.cdnPro;
    throw new Error(`Credential file ${p} must be {host,user,secretKey} or {cdnPro:{host,user,secretKey}}`);
  }

  // 2) Environment variables
  const env = process.env;
  const host = args.host || env.CDNPRO_HOST;
  const user = args.user || env.CDNPRO_USER;
  const secretKey = args.secretKey || env.CDNPRO_SECRETKEY;
  if (host && user && secretKey) return { host, user, secretKey };

  throw new Error(
    'Missing credentials. Provide --cred <file.json> OR env CDNPRO_HOST, CDNPRO_USER, CDNPRO_SECRETKEY (or --host/--user/--secretKey).',
  );
}

async function run() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(`
Usage:
  node cdn/js/integration-test-client.js --cred ./credentials.json
  node cdn/js/integration-test-client.js --host <host> --user <user> --secretKey <secretKey>

Env alternative:
  export CDNPRO_HOST=...
  export CDNPRO_USER=...
  export CDNPRO_SECRETKEY=...
  node cdn/js/integration-test-client.js

Optional flags:
  --onBehalfOf <customerId>     sets On-Behalf-Of header
  --reportRange <self-only|self+children|children-only> sets Report-Range header
  --verbose <0-5>               enables verbose logging in HTTP core
  --resourceCustomerId <id|me>  customerId used for /cdn/resourceSummary (default: me)
  --write                       enable write probes (creates/deletes a webhook)
  --webhookUrl <url>            webhook URL used in write probe (default: https://example.invalid/webhook)
`);
    process.exit(0);
  }

  const serverInfo = loadServerInfo(args);
  const client = new CDNProClient(serverInfo);

  const reqDefaults = {
    verbose: args.verbose ? Number(args.verbose) : 0,
    reportRange: args.reportRange || undefined,
    onBehalfOf: args.onBehalfOf || undefined,
    abortOnError: false, // for integration probing, keep going
    raw: true, // keep ctx for debugging
  };

  console.log('CDNProClient integration test');
  console.log('Host:', serverInfo.host);
  if (reqDefaults.onBehalfOf) console.log('On-Behalf-Of:', reqDefaults.onBehalfOf);
  if (reqDefaults.reportRange) console.log('Report-Range:', reqDefaults.reportRange);

  const results = [];
  async function probe(name, fn) {
    const start = Date.now();
    console.log('Probing:', name);
    try {
      const rsp = await fn();
      const status = rsp?.ctx?._res?.statusCode;
      const ok = typeof status === 'number' ? status >= 200 && status < 400 : true;
      let message;
      if (!ok) {
        const body = rsp?.obj;
        if (body && typeof body === 'object' && (body.code || body.message)) {
          message = `${body.code || 'Error'}: ${body.message || ''}`.trim();
        }
      }
      results.push({ name, ok, status, ms: Date.now() - start, message });
      return rsp;
    } catch (e) {
      const status = e?.ctx?._res?.statusCode || e?.ctx?.err?.statusCode;
      results.push({ name, ok: false, status, ms: Date.now() - start, message: e.message });
      return null;
    }
  }

  // ---- Safe read-only probes ----
  await probe('systemConfigs.get', () => client.systemConfigs.get(reqDefaults));
  await probe('geo.clientRegions', () => client.geo.clientRegions(reqDefaults));
  await probe('geo.isps', () => client.geo.isps({ limit: 10 }, reqDefaults));

  await probe('properties.list', () => client.properties.list({ target: 'production', limit: 1 }, reqDefaults));
  // Some deployments are strict about certificate list query params; keep this minimal.
  await probe('certificates.list', () => client.certificates.list({ limit: 1 }, {...reqDefaults, verbose: 1}));
  await probe('edgeHostnames.list', () => client.edgeHostnames.list({ limit: 1 }, reqDefaults));
  await probe('secrets.list', () => client.secrets.list({ limit: 1 }, reqDefaults));
  await probe('serviceQuotas.list', () => client.serviceQuotas.list({ limit: 1 }, reqDefaults));

  // Admin endpoints may require reseller/admin privileges; probe anyway.
  await probe('customers.list (admin)', () => client.customers.list({ limit: 1 }, reqDefaults));

  await probe('validations.list', () => client.validations.list({ limit: 1 }, reqDefaults));
  await probe('webhooks.list', () => client.webhooks.list({ limit: 1 }, reqDefaults));

  // Resource summary can be called with an explicit customerId. Use "me" if caller supports it, otherwise omit.
  await probe('resourceSummary.getByCustomer', () => client.resourceSummary.getByCustomer(args.resourceCustomerId || 'me', reqDefaults));

  // Purge tokens requires target; try production by default.
  await probe('purges.tokens', () => client.purges.tokens({ target: 'production' }, reqDefaults));

  // ---- Optional write probes (explicit opt-in) ----
  if (args.write) {
    console.log('\nWrite probes enabled (--write).');
    const webhookName = `client-it-${Date.now()}`;

    const created = await probe('webhooks.create', async () =>
      client.webhooks.create(
        {
          name: webhookName,
          description: 'integration test webhook (safe to delete)',
          url: args.webhookUrl || 'https://example.invalid/webhook',
        },
        reqDefaults,
      ),
    );

    // Best-effort cleanup: fetch ID from Location header if present.
    const loc = created?.ctx?._res?.headers?.location;
    if (loc) {
      const id = String(loc).split('/').pop();
      await probe('webhooks.delete (cleanup)', () => client.webhooks.delete(id, reqDefaults));
    } else {
      console.log('No Location header returned; skipping webhook cleanup.');
    }
  }

  console.log('\nSummary:');
  for (const r of results) {
    if (r.ok) console.log(`  OK   ${r.status || '-'}  ${r.ms}ms  ${r.name}`);
    else console.log(`  FAIL ${r.status || '-'}  ${r.ms}ms  ${r.name}  ${r.message || ''}`.trimEnd());
  }

  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length ? 2 : 0);
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

