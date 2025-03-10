const https = require('https');
const http = require('http');
const fs = require('fs');
const zlib = require('zlib');
const xml2js = require('xml2js');
const crypto = require('crypto');

let xmlParser = new xml2js.Parser();
let serverSecret = null;

const setServerInfo = function(serverInfo) {
    serverSecret = serverInfo;
}

const REPORT_RANGES = {
    SELF: 'self-only',
    SELF_CHILDREN: 'self+children',
    CHILDREN_ONLY: 'children-only'
}

const buildAuth = function(serverInfo, options) {
    serverInfo = serverInfo || serverSecret;
    if (serverInfo === null) {
        throw new Error('Server Secret is not set');
    }
    const now = new Date();
    const dateStr = now.toUTCString();
    const hmac = crypto.createHmac('sha1', serverInfo.secretKey);
    hmac.update(dateStr);
    const b64passwd = hmac.digest('base64');
    const authData = Buffer.from(serverInfo.user+':'+b64passwd).toString('base64');

    const r = {
      hostname: serverInfo.host,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': ' Basic '+authData,
        'Date': dateStr,
        'Accept-Encoding': 'gzip',
        'User-Agent': 'CDNProCLI-js/1.0'
      },
      timeout: 10000, //socket connection times out in 10 seconds
      abortOnError: true,  //abort if status code is not 200 or 201
      verbose: 0,
    };
    if (options) {
        if (options.noCache === true) {
            r.headers['Cache-Control']='no-cache';
        }
        if (options.includeChildren === true) {
            r.headers['Report-Range']='self+children';
        }
        if (options.reportRange) {
            let rr = options.reportRange;
            if (rr === 'self-only' || rr === 'self+children' || rr === 'children-only') {
                r.headers['Report-Range']=rr;
            } else {
                throw new Error(`reportRange '${rr}' is not recognized`);
            }
        }
        if (options.onBehalfOf) {
            r.headers['On-Behalf-Of']=options.onBehalfOf;
        }
        if (options.debug != null) {
            r.headers['x-debug']=options.debug;
        }
        if (options.abortOnError != null) {
            r.abortOnError = options.abortOnError;
        }
        if (options.verbose != null) {
            r.verbose = options.verbose;
        }
    }
    return r;
}

/*
    * options: {
    *   hostname: 'hostname',
    *   path: '/path/to/resource',
    *   method: 'GET' or 'POST',
    *   headers: { 'header1': 'value1', 'header2': 'value2' },
    *   reqBody: 'body of the request',
    *   scheme: 'http' or 'https',
    *   agentOptions: { lookup: (hostname, options, callback) => {} },
    *   debug: true or false,
    *   verbose: 0-5,
    *   ctx: { any: 'data' },
    *   abortOnError: true or false
    * }
    * proc: function(obj, ctx) { } optional
    *   obj: response body object
    *   ctx: context object
    * returns: Promise or void
    *   if proc is undefined, returns a Promise with data={obj, ctx}
    *   if proc is defined, returns void
*/
const callServer = function(options, proc) {
    const stime = Date.now();
    const body = options.reqBody;
    if (options.headers === undefined) options.headers = {};
    if (body) options.headers['Content-Length']=`${Buffer.byteLength(body)}`;
    const ctx = options.ctx||{};
    ctx.options = options; // keep a copy of the options
    ctx.times = {start:stime}; // keep timestamps of the call

    let scheme = https;
    if (options.scheme === 'http') scheme = http;
    else options.scheme = 'https';

    // to override DNS to always resolve to a certain IP address:
    // agentOptions:{lookup:(h,o,c)=>{c(null,'58.220.72.220',4);}}
    // to override DNS to always resolve to a another hostname:
    // agentOptions:{lookup:(h,o,c)=>{dns.lookup('other.hostname.com',o,c);}}
    if (options.agentOptions && options.agentOptions.lookup) {
        options.lookup = options.agentOptions.lookup;
    }
    options.agent = new scheme.Agent(options);

    if (options.verbose > 1) {
        console.log(options.method, options.scheme+'//'+options.hostname+options.path);
        console.log(options.headers);
        if (body) console.log(body, '\n');
    }

    const requestAndProc = function(resolve, reject) {
        let request = scheme.request(options, (res) => {
            //this is the callback function when the response header is received.
            const hdrTime = Date.now();
            ctx._res = res;
            ctx.times.header = hdrTime;
            ctx.remoteAddress = res.socket.remoteAddress;
            res.socket.peerCertificate = res.socket.getPeerCertificate();
            if (options.debug) {
                console.log(stringify(res));
            }
            if (res.statusCode !== 200 && res.statusCode !== 201) {
                if (options.verbose > 0) {
                    console.error(`Did not get an OK from the server, Code: ${res.statusCode}`);
                    console.error(`${options.method} ${options.host}${options.path}`);
                    console.error('Response Headers', res.headers);
                    console.error('Request Headers', options.headers);
                }
                // continue to read the response body
            }
            let uncomp = null;
            let ce = res.headers['content-encoding'];
    //        console.log(`Contenr-Encoding: ${ce}`);
            switch (ce) {
                case 'br':
                    uncomp = zlib.createBrotliDecompress();
                    break;
                case 'gzip':
                    uncomp = zlib.createGunzip();
                    break;
            }
            let data = '';
            let len = 0;
    // a good tutorial about stream
    //  https://www.freecodecamp.org/news/node-js-streams-everything-you-need-to-know-c9141306be93/
            res.on('data', (chunk) => {
                len += chunk.length;
                if (uncomp) uncomp.write(chunk);
                else data += chunk;
            });
            const finalProc = function() {
                const resTime = Date.now();
                ctx.times.finish = resTime;
                ctx.bodyBytes={raw:len, decoded:data.length};
                let statusOk = res.statusCode === 200 || res.statusCode === 201;

                if (options.verbose > 0) {
                    const headerSec = (hdrTime - stime)/1000;
                    const totalSec = (resTime - stime)/1000;
                    console.log(`hdrTime ${headerSec}s, total ${totalSec}s, got status ${res.statusCode} w/ ${len} => ${data.length} bytes from `+ options.hostname+options.path);
                }
                const callBack = function(obj) {
                    if (statusOk || options.abortOnError !== true) {
                        if (resolve) {
                            resolve({obj, ctx});
                        } else
                            proc(obj, ctx);
                    } else {
                        const err = new Error('Status code is not 200 or 201');
                        err.body = obj;
                        if (reject) {
                            reject(err);
                        } else {
                            throw err;
                        }
                    }
                }
                let ct = res.headers['content-type'] || '';
                if (ct.indexOf('application/json') > -1) {
                    const obj = JSON.parse(data);
                    callBack(obj);
                }else if (ct.indexOf('application/xml') > -1) {
                    xmlParser.parseString(data, (err, obj)=>{
                        callBack(obj);
                    });
                }else {
                    callBack(data);
                }
            }
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
            if (options.verbose > 0) {
                console.error('Request to '+options.host+options.path+` got error:\n${err.message}`);
            }
            if (reject) {
                err.ctx = ctx;
                reject(err);
            } else if (proc && options.abortOnError !== true) {
                const resTime = Date.now();
                ctx.times.finish = resTime;
                ctx.err = err; //in case of error, ctx.err is set
                proc(null, ctx);
            }
        });

        //get the timestamp of the connection
        request.on('socket', (socket) => {
            ctx.times.socket = Date.now();
            socket.on('lookup', () => {
                ctx.times.dns = Date.now();
            });
            socket.on('connect', () => {
                ctx.times.connect = Date.now();
            });
            if (scheme === https) {
                // get the timestamp of TLS handshake
                socket.on('secureConnect', () => {
                    ctx.times.tls = Date.now();
                });
            }
        });

        request.setTimeout(30000, () => {
            if (options.verbose > 0) {
                console.error('Request to '+options.host+options.path+' timed out after 30 seconds.');
            }
            if (reject) {
                const err = new Error('Request timed out after 30 seconds.');
                err.ctx = ctx;
                reject(err);
            } else if (proc && options.abortOnError !== true) {
                const resTime = Date.now();
                ctx.times.finish = resTime;
                ctx.err = new Error('Request timed out after 30 seconds.');
                proc(null, ctx);
            }
        });

        if (body) request.write(body); //for POST
        request.end();
    } //end of requestAndProc
    if (proc === undefined) { // when proc is not defined, return a promise
        return new Promise(requestAndProc);
    } else {
        requestAndProc();
    }
}

var stringify = function(obj) {
    return JSON.stringify(replaceCircular6(obj), null, 2);
};

var replaceCircular6 = function(val, cache) {

    cache = cache || new WeakSet();

    if (val && typeof(val) == 'object') {
        if (cache.has(val)) return '[Circular]';

        cache.add(val);

        var obj = (Array.isArray(val) ? [] : {});
        for(var idx in val) {
            obj[idx] = replaceCircular6(val[idx], cache);
        }

        cache.delete(val);
        return obj;
    }

    return val;
};

/*
    rangeSpec: {
      start: '2022-02-26Z-8', // optional
      end: 'now', // optional
      span: '7d', // optional
      center: '2022-02-26Z-8' // optional
    }
*/
const reqTimeRange = function(rangeSpec) {
    let endDate = null;
    let startDate = null;
    let now = new Date();

    if (rangeSpec.end) {
        if (rangeSpec.end === 'now') {
            endDate = now;
        } else
            endDate = new Date(rangeSpec.end);
    }
    if (rangeSpec.start) {
        startDate = new Date(rangeSpec.start);
    }
    if (endDate === null || startDate === null) {
        if (rangeSpec.span == null) {
            throw new Error('span is not defined');
        }
        // convert the span to milliseconds
        // span is a string like '1d', '2h', '3m', '4s'
        const span = rangeSpec.span;
        let spanVal = parseInt(span);
        if (isNaN(spanVal)) {
            throw new Error('span value is not a number');
        }
        let spanUnit = span.slice(-1);
        let spanMs = 0;
        switch (spanUnit) {
            case 'd':
                spanMs = spanVal * 86400000;
                break;
            case 'h':
                spanMs = spanVal * 3600000;
                break;
            case 'm':
                spanMs = spanVal * 60000;
                break;
            case 's':
                spanMs = spanVal * 1000;
                break;
            default:
                throw new Error('span unit is not recognized');
        }
        if (startDate) { // if start is defined, end is calculated from start
            endDate = new Date(startDate.getTime() + spanMs);
        } else if (endDate) { // if end is defined, start is calculated from end
            startDate = new Date(endDate.getTime() - spanMs);
        } else if (rangeSpec.center) {
            const center = new Date(rangeSpec.center);
            startDate = new Date(center.getTime() - spanMs/2);
            endDate = new Date(center.getTime() + spanMs/2);
        } else {
            throw new Error('missing start, end, or center');
        }
    }
    if (endDate > now) endDate = now;
    if (endDate <= startDate) {
        throw new Error('end date is not after start date');
    }
    // return a string: 'startDate=...&endDate=...'
    return `startDate=${encodeURIComponent(startDate.toISOString().substring(0,19)+'Z')}&`+
           `endDate=${encodeURIComponent(endDate.toISOString().substring(0,19)+'Z')}`;
}

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function askQuestion(query) {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

const Diff = require('diff');
function diffObjects(a, b) {
    const diff = Diff.diffJson(a, b);
//    console.log('Diff:', diff);
    let diffTxt = '';
    diff.forEach((part) => {
        let change = part.added ? '+' : part.removed ? '-' : null;
        if (change) {
            diffTxt += change + part.value.split('\n').slice(0,-1).join('\n'+change) + '\n';
        }
    });
    return diffTxt;
}

async function getCustomer(customerId, o) {
    if (customerId === '--help') {
        return {usage: 'getCustomer customerId', minArgs: 1, maxArgs: 1};
    }
    if (customerId && customerId.argv) { // support passing arguments as an array
        o = customerId.options;
        customerId = customerId.argv[0];
    }
    if (o.verbose > 0) {
        console.log(`Getting Info of Customer ${customerId}...`);
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/ngadmin/customers/${customerId}`;
    const customer = await callServer(options);
    return customer.obj;
}

function buildQueryParams(o, paramList) {
    let qs = [];
    if (o) {
        paramList.push('limit','offset');
        for (let p of paramList) {
            if (o[p]) {
                if (Array.isArray(o[p])) {
                    let commaList = o[p].map(encodeURIComponent).join(',');
                    qs.push(`${p}=${commaList}`);
                } else
                    qs.push(`${p}=${encodeURIComponent(o[p])}`);
            }
        }
        if (o.end || o.start || o.span || o.center) {
            qs.push(reqTimeRange(o));
        }
    }
    if (qs.length > 0) {
        // return url encoded query string
        return '?' + qs.join('&');
    }
    return '';
}

async function listCustomers(o) {
    if (o === '--help') {
        return {usage: 'listCustomers', minArgs: 0, maxArgs: 0};
    }
    if (o && o.argv) { // support passing arguments as an array
        o = o.options;
    }
    if (o.verbose > 0) {
        console.log('Getting Customer List ...');
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/ngadmin/customers`;
    // parameters supported by this endpoint
    const paramList = ['search','status','type','parentId','email',
                       'ids','regionalOffices','products'];
    options.path += buildQueryParams(o, paramList);
    const customer = await callServer(options);
    return customer.obj;
}

async function getPropertyVersion(id_or_domain, ver, o) {
    if (id_or_domain === '--help') {
        return {usage: 'getPropertyVersion id_or_domain production/staging/latest/number', minArgs: 2, maxArgs: 2};
    }
    if (id_or_domain && id_or_domain.argv) { // support passing arguments as an array
        ver = id_or_domain.argv[1];
        o = id_or_domain.options;
        id_or_domain = id_or_domain.argv[0];
    }
    let isDomain = id_or_domain.indexOf('.') > 0;
    let id = id_or_domain;
    let verN = ver;
    if (isDomain) {
        if (verN == null) {
            verN = 'production'; // for domain name, default to production
        } else if (verN !== 'production' && verN !== 'staging') {
            throw new Error('version must be production or staging');
        }
    }
    if (o.verbose > 0) {
        let msg = `Getting Property ${id_or_domain} ` + (ver ? `version ${ver} ` : '') + '...';
        console.log(msg);
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    if (isDomain || verN === 'production' || verN === 'staging') {
        const pList = await listProperties({search:'^'+id_or_domain, target: verN, includeChildren:true});
        if (pList.count === 0) {
            throw new Error(`Property ${id_or_domain} not found in ${verN}`);
        }
        let p = pList.properties.filter(p => p.id === id_or_domain || p[verN+'Version'].hostnames.includes(id_or_domain));
        if (p.length === 0) {
            throw new Error(`Property ${id_or_domain} not found in ${verN}`);
        }
        if (p.length > 1) {
            throw new Error(`Multiple properties with ${id_or_domain} found in ${verN}`);
        }
        id = p[0].id;
        verN = p[0][verN+'Version'].version;
    }
    options.path = `/cdn/properties/${id}` + (ver ? `/versions/${verN}` : '');
    // parameters supported by this endpoint
    const customer = await callServer(options);
    customer.obj._propertyId_ = id;
    return customer.obj;
}

function getProperty(id_or_domain, o) {
    if (id_or_domain === '--help') {
        return {usage: 'getProperty id_or_domain', minArgs: 1, maxArgs: 1};
    }
    if (id_or_domain && id_or_domain.argv) { // support passing arguments as an array
        o = id_or_domain.options;
        id_or_domain = id_or_domain.argv[0];
    }
    if (o.verbose > 0) {
        console.log(`Getting Property ${id_or_domain} ...`);
    }
    return getPropertyVersion(id_or_domain, null, o);
}

async function listProperties(o) {
    if (o === '--help') {
        return {usage: 'listProperties', minArgs: 0, maxArgs: 0};
    }
    if (o && o.argv) { // support passing arguments as an array
        o = o.options;
    }
    if (o.verbose > 0) {
        console.log('Getting Property List ...');
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = '/cdn/properties';
    // parameters supported by this endpoint
    const paramList = ['search','hasConfig','target','sortBy','sortOrder','tags','legacyType','isHcdn'];
    options.path += buildQueryParams(o, paramList);
    const serviceQuotaList = await callServer(options);
    return serviceQuotaList.obj;
}

async function getServiceQuota(customerId, o) {
    if (customerId === '--help') {
        return {usage: 'getServiceQuota customerId', minArgs: 1, maxArgs: 1};
    }
    if (customerId && customerId.argv) { // support passing arguments as an array
        o = customerId.options;
        customerId = customerId.argv[0];
    }
    if (customerId == null) {
        throw new Error('customerId is not defined');
    }
    if (o.verbose > 0) {
        console.log('Getting Service Quota ...');
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/cdn/serviceQuotas/customer/${customerId}`;
    const serviceQuota = await callServer(options);
    //console.log('Service Quota:', serviceQuota.obj);
    return serviceQuota.obj;
}

async function listServiceQuotas(o) {
    if (o === '--help') {
        return {usage: 'listServiceQuotas', minArgs: 0, maxArgs: 0};
    }
    if (o && o.argv) { // support passing arguments as an array
        o = o.options;
    }
    if (o.verbose > 0) {
        console.log('Getting Service Quota List ...');
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = '/cdn/serviceQuotas';
    // parameters supported by this endpoint
    const paramList = ['search','status','allowProduction','usageLimit','contractId','allowedCacheDirectives',
                       'accountManagerEmail','advancedFeatures'];
    options.path += buildQueryParams(o, paramList);
    const serviceQuotaList = await callServer(options);
    return serviceQuotaList.obj;
}

async function patchServiceQuota(serviceQuotaId, obj) {
    console.log('Patching Service Quota ...');
    const options = buildAuth(); // use the default server info from setServerInfo()
    options.path = `/cdn/serviceQuotas/${serviceQuotaId}`;
    options.method = 'PATCH';
    options.headers['Content-Type']='application/json; charset=UTF-8';
    options.reqBody = JSON.stringify(obj);
    const serviceQuota = await callServer(options);
    return serviceQuota.obj;
}

async function getSystemConfigs(o) {
    if (o === '--help') {
        return {usage: 'getSystemConfigs', minArgs: 0, maxArgs: 0};
    }
    if (o && o.argv) { // support passing arguments as an array
        o = o.options;
    }
    if (o.verbose > 0) {
        console.log('Getting systemConfigs ...');
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/cdn/systemConfigs`;
    const apiResp = await callServer(options);
    //console.log('systemConfigs:', apiResp.obj);
    return apiResp.obj;
}

async function patchSystemConfigs(obj) {
    console.log('Patching systemConfigs ...');
    const options = buildAuth(); // use the default server info from setServerInfo()
    options.path = `/cdn/systemConfigs`;
    options.method = 'PATCH';
    options.headers['Content-Type']='application/json; charset=UTF-8';
    options.reqBody = JSON.stringify(obj);
    const systemConfig = await callServer(options);
    return systemConfig.obj;
}

async function getBandwidth(customerId, o) {
    if (customerId === '--help') {
        return {usage: 'getBandwidth customerId', minArgs: 1, maxArgs: 1};
    }
    if (customerId && customerId.argv) { // support passing arguments as an array
        o = customerId.options;
        customerId = customerId.argv[0];
    }
    if (customerId == null) {
        throw new Error('customerId is not defined');
    }
    o.onBehalfOf = customerId;
    if (o.verbose > 0) {
        console.log('Getting Bandwidth of customer ${customerId} ...');
    }
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/cdn/report/bandwidth`;
    const paramList = ['type'];
    options.path += buildQueryParams(o, paramList);
    options.method = 'POST';
    options.reqBody = '{}';
    options.headers['Content-Type']='application/json; charset=UTF-8';

    const bandwidth = await callServer(options);
    return bandwidth.obj;
}

const cdnpro = {
    setServerInfo: setServerInfo,
    REPORT_RANGES: REPORT_RANGES,
    buildAuth: buildAuth,
    callServer: callServer,
    reqTimeRange: reqTimeRange,
    askQuestion: askQuestion,
    diffObjects: diffObjects,
    getCustomer: getCustomer,
    listCustomers: listCustomers,
    getProperty: getProperty,
    getPropertyVersion: getPropertyVersion,
    listProperties: listProperties,
    getServiceQuota: getServiceQuota,
    listServiceQuotas: listServiceQuotas,
    patchServiceQuota: patchServiceQuota,
    getSystemConfigs: getSystemConfigs,
    getBandwidth: getBandwidth,
    patchSystemConfigs: patchSystemConfigs
}

exports.buildAuth = buildAuth;
exports.callServer = callServer;
exports.cdnpro = cdnpro; 
