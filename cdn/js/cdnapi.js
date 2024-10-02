const { buildAuth, callServer } = require('./qtl-api-tools');
const { cred } = require('./SECRET_credentials');

function listProperties({limit = 5, range = 'self+children', target = 'production'}) {
    let ngOptions = buildAuth(cred.ngServer); //build the auth header from credential
    // fill in the details of the API endpoint
    ngOptions.path = `/cdn/properties?target=${target}&limit=${limit}`;
    ngOptions.headers['Report-Range']=range;
    ngOptions.abortOnError = false;
    // make the call, supply the callback function
    callServer(ngOptions, ngProcProperties);
}

// the callback function, takes 2 parameters.
// the first one is the json object of the response body
// the second one is a context, which contains details about the API request and response
function ngProcProperties(jsonData, ctx) {
    console.log(jsonData);
}

listProperties({limit:3});
