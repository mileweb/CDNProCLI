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
        'Accept-Encoding': 'gzip'
      },
      timeout: 10000, //socket connection times out in 10 seconds
      abortOnError: true  //abort if status code is not 200 or 201
    };
    if (options) {
        if (options.noCache === true) {
            r.headers['Cache-Control']='no-cache';
        }
        if (options.quiet != null) {
            r.quiet = options.quiet;
        }
        if (options.debug != null) {
            r.debug = options.debug;
        }
        if (options.abortOnError != null) {
            r.abortOnError = options.abortOnError;
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
    *   quiet: true or false,
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

    // to override DNS to always resolve to a certain IP address:
    // agentOptions:{lookup:(h,o,c)=>{c(null,'58.220.72.220',4);}}
    // to override DNS to always resolve to a another hostname:
    // agentOptions:{lookup:(h,o,c)=>{dns.lookup('other.hostname.com',o,c);}}
    if (options.agentOptions && options.agentOptions.lookup) {
        options.lookup = options.agentOptions.lookup;
    }
    options.agent = new scheme.Agent(options);

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
                if (options.quiet !== true) {
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

                if (options.quiet !== true) {
                    const headerSec = (hdrTime - stime)/1000;
                    const totalSec = (resTime - stime)/1000;
                    console.log(`hdrTime ${headerSec}s, total ${totalSec}s, got status ${res.statusCode} w/ ${len} => ${data.length} bytes from `+ options.host+options.path);
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
            if (options.quiet !== true) {
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
            if (options.quiet !== true) {
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
    * rangeSpec: {
    *  start: '2022-02-26Z-8', // optional
    *  end: 'now', // optional
    *  span: '7d', // optional
    * center: '2022-02-26Z-8' // optional
    * }
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
    return `startDate=${startDate.toISOString().substring(0,19)+'Z'}&endDate=${endDate.toISOString().substring(0,19)+'Z'}`;
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
    let diffTxt = '';
    diff.forEach((part) => {
        let change = part.added ? '+' : part.removed ? '-' : null;
        if (change) {
            diffTxt += change + part.value;
        }
    });
    return diffTxt;
}

async function getCustomer(customerId, o) {
    console.log('Getting Customer Info ...');
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/ngadmin/customers/${customerId}`;
    options.quiet = true;
    const customer = await callServer(options);
    return customer.obj;
}

async function getServiceQuota(customerId, o) {
    console.log('Getting Service Quota ...');
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/cdn/serviceQuotas/customer/${customerId}`;
    options.quiet = true;
    const serviceQuota = await callServer(options);
    //console.log('Service Quota:', serviceQuota.obj);
    return serviceQuota.obj;
}

async function patchServiceQuota(serviceQuotaId, obj) {
    console.log('Patching Service Quota ...');
    const options = buildAuth(); // use the default server info from setServerInfo()
    options.path = `/cdn/serviceQuotas/${serviceQuotaId}`;
    options.method = 'PATCH';
    options.headers['Content-Type']='application/json; charset=UTF-8';
    options.reqBody = JSON.stringify(obj);
    options.quiet = true;
    const serviceQuota = await callServer(options);
    return serviceQuota.obj;
}

async function getSystemConfigs(o) {
    console.log('Getting systemConfigs ...');
    const options = buildAuth(null, o); // use the default server info from setServerInfo()
    options.path = `/cdn/systemConfigs`;
    options.quiet = true;
    const apiResp = await callServer(options);
    //console.log('systemConfigs:', apiResp.obj);
    return apiResp.obj;
}

const cdnpro = {
    setServerInfo: setServerInfo,
    buildAuth: buildAuth,
    callServer: callServer,
    reqTimeRange: reqTimeRange,
    askQuestion: askQuestion,
    diffObjects: diffObjects,
    getCustomer: getCustomer,
    getServiceQuota: getServiceQuota,
    patchServiceQuota: patchServiceQuota,
    getSystemConfigs: getSystemConfigs
}

exports.buildAuth = buildAuth;
exports.callServer = callServer;
exports.cdnpro = cdnpro; 
