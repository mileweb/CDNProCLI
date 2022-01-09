const fs = require('fs');
const qtlapi = require('./qtl-api-tools');
const { cred } = require('./SECRET_credentials');

function getProperties({limit = 5, range = 'self+children', target = 'production'}) {
    let ngOptions = qtlapi.buildAuth(cred.ngServer);
    ngOptions.path = `/cdn/properties?target=${target}&limit=${limit}`;
    ngOptions.headers['Report-Range']=range;
    ngOptions.abortOnError = false;
    qtlapi.callServer(ngOptions, ngProcProperties);
}

// process NG properties list
ngProcProperties = function(jsonData) {
    console.log(jsonData);
}

getProperties({limit:3});