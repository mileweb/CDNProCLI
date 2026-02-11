const https = require('https');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function encodeQuery(query) {
  if (!query) return '';
  const parts = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      // Most CDN Pro endpoints accept comma-separated lists.
      parts.push(`${encodeURIComponent(key)}=${value.map((x) => encodeURIComponent(String(x))).join(',')}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function withQuery(path, query) {
  if (!query || Object.keys(query).length === 0) return path;
  const qs = encodeQuery(query);
  if (!qs) return path;
  if (path.includes('?')) return `${path}&${qs.slice(1)}`;
  return `${path}${qs}`;
}

class ApiCore {
  constructor(serverInfo, defaults = {}) {
    if (!serverInfo) throw new Error('serverInfo is required');
    this.serverInfo = serverInfo;
    this.defaults = defaults || {};

    this._agents = null;
    this._ensureAgents();
  }

  _ensureAgents() {
    if (this._agents) return;
    const base = {
      keepAlive: true,
      keepAliveMsecs: 30_000,
      maxSockets: 256,
      maxFreeSockets: 64,
    };
    if (this.serverInfo.family) base.family = this.serverInfo.family;

    this._agents = {
      http: new http.Agent(base),
      https: new https.Agent(base),
    };
  }

  _resetAgents() {
    if (this._agents) {
      try {
        this._agents.http.destroy();
      } catch (_) {
        // ignore
      }
      try {
        this._agents.https.destroy();
      } catch (_) {
        // ignore
      }
    }
    this._agents = null;
    this._ensureAgents();
  }

  _buildAuth(options) {
    const serverInfo = this.serverInfo;
    if (!serverInfo || !serverInfo.host || !serverInfo.user || !serverInfo.secretKey) {
      throw new Error('serverInfo must include {host, user, secretKey}');
    }

    const now = new Date();
    const dateStr = now.toUTCString();
    const hmac = crypto.createHmac('sha1', serverInfo.secretKey);
    hmac.update(dateStr);
    const b64passwd = hmac.digest('base64');
    const authData = Buffer.from(`${serverInfo.user}:${b64passwd}`).toString('base64');

    const out = {
      hostname: serverInfo.host,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: ` Basic ${authData}`,
        Date: dateStr,
        'Accept-Encoding': 'gzip',
        'User-Agent': 'CDNProCLI-js/1.0',
      },
      timeout: 10000,
      abortOnError: true,
      verbose: 0,
      ...options,
    };

    if (serverInfo.family) out.family = serverInfo.family;

    if (options) {
      if (options.noCache === true) out.headers['Cache-Control'] = 'no-cache';
      if (options.includeChildren === true) out.headers['Report-Range'] = 'self+children';
      if (options.reportRange) out.headers['Report-Range'] = options.reportRange;
      if (options.onBehalfOf != null) out.headers['On-Behalf-Of'] = String(options.onBehalfOf);
      if (options.debug != null) out.headers['x-debug'] = options.debug;
      if (options.abortOnError != null) out.abortOnError = options.abortOnError;
      if (options.verbose != null) out.verbose = options.verbose;
    }

    return out;
  }

  async _callServer(options) {
    const stime = Date.now();
    const body = options.reqBody;
    if (options.headers === undefined) options.headers = {};
    if (body !== undefined && body !== null) options.headers['Content-Length'] = `${Buffer.byteLength(body)}`;

    const ctx = options.ctx || {};
    ctx.options = options;
    ctx.times = { start: stime };

    const scheme = options.scheme === 'http' ? http : https;
    options.scheme = options.scheme === 'http' ? 'http' : 'https';

    // Default behavior: reuse connections via keep-alive agents.
    // If caller wants a brand new connection, they should pass { newConnection: true } to request().
    this._ensureAgents();
    options.agent = options.scheme === 'http' ? this._agents.http : this._agents.https;

    if (options.verbose > 1) {
      const portPart = options.port ? `:${options.port}` : '';
      // eslint-disable-next-line no-console
      console.log(options.method, `${options.scheme}://${options.hostname}${portPart}${options.path}`);
      // eslint-disable-next-line no-console
      console.log(options.headers);
      if (body) console.log(body, '\n');
    }

    return await new Promise((resolve, reject) => {
      const request = scheme.request(options, (res) => {
        const hdrTime = Date.now();
        ctx._res = res;
        ctx.times.header = hdrTime;
        ctx.remoteAddress = res.socket.remoteAddress;
        if (options.scheme === 'https') {
          res.socket.peerCertificate = res.socket.getPeerCertificate();
        }

        const statusOk = res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204;

        let uncomp = null;
        const ce = res.headers['content-encoding'];
        if (ce === 'br') uncomp = zlib.createBrotliDecompress();
        else if (ce === 'gzip') uncomp = zlib.createGunzip();

        let data = '';
        let len = 0;

        const finalProc = () => {
          const resTime = Date.now();
          ctx.times.finish = resTime;
          ctx.bodyBytes = { raw: len, decoded: data.length };

          if (options.verbose > 0) {
            const headerSec = (hdrTime - stime) / 1000;
            const totalSec = (resTime - stime) / 1000;
            // eslint-disable-next-line no-console
            console.log(
              `hdrTime ${headerSec}s, total ${totalSec}s, got status ${res.statusCode} w/ ${len} => ${data.length} bytes from ${options.method} ${options.hostname}${options.path}`,
            );
          }

          // Decode JSON if indicated; otherwise return raw string.
          let obj = data;
          const ct = res.headers['content-type'] || '';
          if (ct.includes('application/json')) {
            try {
              obj = data.length ? JSON.parse(data) : null;
            } catch (_) {
              obj = data;
            }
          }

          if (statusOk || options.abortOnError !== true) {
            resolve({ obj, ctx });
            return;
          }

          const err = new Error(`Status code is ${res.statusCode}, not 200/201/204`);
          err.body = obj;
          err.ctx = ctx;
          reject(err);
        };

        res.on('data', (chunk) => {
          len += chunk.length;
          if (uncomp) uncomp.write(chunk);
          else data += chunk;
        });

        res.on('end', () => {
          if (uncomp) uncomp.end();
          else finalProc();
        });

        if (uncomp) {
          uncomp.on('data', (chunk) => {
            data += chunk;
          });
          uncomp.on('end', finalProc);
        }
      });

      request.on('error', (err) => {
        err.ctx = ctx;
        reject(err);
      });

      request.on('socket', (socket) => {
        ctx.times.socket = Date.now();

        // Avoid MaxListeners warnings if a socket is ever reused.
        const flag = '__cdnproTimingListenersAttached';
        if (socket && socket[flag] !== true) {
          socket[flag] = true;
          socket.once('lookup', () => {
            ctx.times.dns = Date.now();
          });
          socket.once('connect', () => {
            ctx.times.connect = Date.now();
          });
          if (scheme === https) {
            socket.once('secureConnect', () => {
              ctx.times.tls = Date.now();
            });
          }
        }
      });

      request.setTimeout(30000, () => {
        const err = new Error('Request timed out after 30 seconds.');
        err.ctx = ctx;
        reject(err);
      });

      if (body !== undefined && body !== null) request.write(body);
      request.end();
    });
  }

  /**
   * Perform a request to the CDN Pro API.
   *
   * @param {string} method HTTP method
   * @param {string} path API path starting with /cdn/... or /ngadmin/...
   * @param {object} [req]
   * @param {object} [req.query] query params
   * @param {object|string|Buffer|null} [req.body] request body
   * @param {object} [req.headers] extra headers
   * @param {string|number} [req.onBehalfOf] sets On-Behalf-Of header
   * @param {string} [req.reportRange] sets Report-Range header
   * @param {boolean} [req.noCache] sets Cache-Control: no-cache
   * @param {boolean} [req.abortOnError] override abort behavior
   * @param {number} [req.verbose] verbosity level (0-5)
   * @param {any} [req.debug] pass-through debug header support
   * @param {boolean} [req.raw] when true, return {obj, ctx}
   */
  async request(method, path, req = {}) {
    const merged = { ...this.defaults, ...(req || {}) };

    if (merged.newConnection === true) {
      // Close old keep-alive sockets and ensure next request establishes a new connection.
      this._resetAgents();
    }

    const options = this._buildAuth({
      noCache: merged.noCache,
      includeChildren: merged.includeChildren,
      reportRange: merged.reportRange,
      onBehalfOf: merged.onBehalfOf,
      abortOnError: merged.abortOnError,
      verbose: merged.verbose,
      debug: merged.debug,
    });

    options.method = method;
    options.path = withQuery(path, merged.query);

    if (merged.headers) {
      options.headers = { ...options.headers, ...merged.headers };
    }

    if (merged.body !== undefined && merged.body !== null) {
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json; charset=UTF-8';
      }
      if (Buffer.isBuffer(merged.body) || typeof merged.body === 'string') {
        options.reqBody = merged.body;
      } else if (isPlainObject(merged.body) || Array.isArray(merged.body)) {
        options.reqBody = JSON.stringify(merged.body);
      } else {
        options.reqBody = String(merged.body);
      }
    }

    const rsp = await this._callServer(options);
    return merged.raw ? rsp : rsp.obj;
  }
}

module.exports = { ApiCore, encodeQuery, withQuery };

