const https = require('https');
const http = require('http');
const fs = require('fs');
const zlib = require('zlib');
const xml2js = require('xml2js');
const crypto = require('crypto');
var xmlParser = new xml2js.Parser();

const buildCncAuth = function(serverInfo) {
    const now = new Date();
    const dateStr = now.toUTCString();
    const hmac = crypto.createHmac('sha1', serverInfo.secretKey);
    hmac.update(dateStr);
    const b64passwd = hmac.digest('base64');
    const authData = Buffer.from(serverInfo.user+':'+b64passwd).toString('base64');

    return {
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
                if (options.abortOnError) {
                    console.log('Aborting ...');
                    res.resume();
                    if (reject) {
                        const err = new Error(`Did not get an OK from the server, Code: ${res.statusCode}`);
                        err.ctx = ctx;
                        reject(err);
                    }
                    return;
                }
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
                if (options.quiet !== true) {
                    const headerSec = (hdrTime - stime)/1000;
                    const totalSec = (resTime - stime)/1000;
                    console.log(`hdrTime ${headerSec}s, total ${totalSec}s, got status ${res.statusCode} w/ ${len} => ${data.length} bytes from `+ options.host+options.path);
                }
                let ct = res.headers['content-type'] || '';
                if (ct.indexOf('application/json') > -1) {
                    const obj = JSON.parse(data);
                    if (resolve) {
                        resolve({obj, ctx});
                    } else
                        proc(obj, ctx);
                }else if (ct.indexOf('application/xml') > -1) {
                    xmlParser.parseString(data, (err, obj)=>{
                        if (resolve) {
                            resolve({obj, ctx});
                        } else
                            proc(obj, ctx)
                    });
                }else {
                    if (reject) {
                        const err = new Error('Unknown content type: '+ct);
                        err.ctx = ctx;
                        reject(err);
                    } else if (proc) {
                        proc(data, ctx);
                    }
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
            console.error('Request to '+options.host+options.path+` got error:\n${err.message}`);
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
            console.error('Request to '+options.host+options.path+' timed out after 30 seconds.');
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
    if (proc === undefined) {
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

exports.buildAuth = buildCncAuth;
exports.callServer = callServer; 
