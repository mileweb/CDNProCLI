const { buildAuth, callServer } = require('./qtl-api-tools');
const { cred } = require('./SECRET_credentials');

function listProperties({limit = 5, range = 'self+children', target = 'production'}) {
    //build the options, including the auth header from credential
    let ngOptions = buildAuth(cred.cdnPro);
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
    console.log(jsonData);
    // dump something from the context
    console.log(ctx.remoteAddress);
    // obtain the response object from the context
    const res = ctx._res;
    // dump the peer certificate of the response
    console.log(res.socket.peerCertificate);
    // ctx.options is the options object used to make the call
    // ctx.times is an object containing timestamps of the call
    console.log(ctx.times);
    // ctx.err is the error object, if any
}

listProperties({limit:3});
