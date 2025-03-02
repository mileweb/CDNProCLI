const { buildAuth, callServer, cdnpro } = require('./cdnpro-helper');
const { cred } = require('./SECRET_credentials');

function listProperties({limit = 5, range = 'self+children', target = 'production'}) {
    //build the options, including the auth header from credential
    const ngOptions = buildAuth(cred.cdnPro);
    // fill in the details of the API endpoint
    ngOptions.path = `/cdn/properties?target=${target}&limit=${limit}`;
    ngOptions.headers['Report-Range']=range;
    // whether to abort the call when error is encountered
    // true means abort the process without calling the callback function.
    // false means do not abort under any circumstances. Always call the callback.
    ngOptions.abortOnError = false;
    // make the call with the options, supply a callback function
    callServer(ngOptions, ngProcProperties);
}

// the callback function, takes 2 parameters.
// the first one is the json object of the response body, may be null in case of error.
// the second one is a context, which contains details about the API request and response.
function ngProcProperties(jsonData, ctx) {
    // dump the body
    console.log('In Callback:', jsonData);
    // dump something from the context
    console.log('In Callback:', ctx.remoteAddress);
    // obtain the response object from the context
    const res = ctx._res;
    // dump the peer certificate of the response
    console.log('In Callback:', res.socket.peerCertificate);
    // ctx.options is the options object used to make the call
    // ctx.times is an object containing timestamps of the call
    console.log('In Callback:', ctx.times);
    // ctx.err is the error object, if any
}

async function listCertificates({limit = 5, range = 'self+children', target = 'production'}) {
    //build the options, including the auth header from credential
    const ngOptions = buildAuth(cred.cdnPro);
    // fill in the details of the API endpoint
    ngOptions.path = `/cdn/certificates?target=${target}&limit=${limit}`;
    ngOptions.headers['Report-Range']=range;
    try {
        // make the call with the options, without a callback function
        // a promise is returned, which will be resolved when the call is completed
        const rsp = await callServer(ngOptions);
        console.log('In Async:', rsp.obj);
        console.log('In Async:', rsp.ctx.remoteAddress);
        const res = rsp.ctx._res;
        console.log('In Async:', res.socket.peerCertificate);
        console.log('In Async:', rsp.ctx.times);
    } catch (err) {
        console.error('In Async:', err);
    }
}

listProperties({limit:3}); // with callback
listCertificates({limit:3}); // with async/await
console.log('API calls are in progress ...');
console.log('Test reqTimeRange ...');
console.log(cdnpro.reqTimeRange({start: '2022-02-26Z-8', span: '7d'}));
console.log(cdnpro.reqTimeRange({end: 'now', span: '30d'}));
console.log(cdnpro.reqTimeRange({center: 'Mar 1, 2025 10:12:34 GMT-8', span: '30m'}));