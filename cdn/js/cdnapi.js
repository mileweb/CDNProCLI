const { buildAuth, callServer } = require('./qtl-api-tools');
const { cred } = require('./SECRET_credentials');

function listProperties({limit = 5, range = 'self+children', target = 'production'}) {
    let ngOptions = buildAuth(cred.cdnPro); //build the auth header from credential
    // fill in the details of the API endpoint
    ngOptions.path = `/cdn/properties?target=${target}&limit=${limit}`;
    ngOptions.headers['Report-Range']=range;
    // whether to abort the call when error is encountered
    // true means abort the process without calling the callback function.
    // false means do not abort under any circumstances. Always call the callback.
    ngOptions.abortOnError = false;
    // make the call, supply the callback function
    callServer(ngOptions, ngProcProperties);
}

// the callback function, takes 2 parameters.
// the first one is the json object of the response body, may be null in case of error.
// the second one is a context, which contains details about the API request and response.
function ngProcProperties(jsonData, ctx) {
    // dump the body
    console.log(jsonData);
    // dump the context
    // console.log(ctx);
}

listProperties({limit:3});
