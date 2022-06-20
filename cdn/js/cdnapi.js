const fs = require('fs');
const qtlapi = require('./qtl-api-tools');
const { cred } = require('./SECRET_credentials');

function listProperties({limit = 5, range = 'self+children', target = 'production'}) {
    let ngOptions = qtlapi.buildAuth(cred.ngServer);
    ngOptions.path = `/cdn/properties?target=${target}&limit=${limit}`;
    ngOptions.headers['Report-Range']=range;
    ngOptions.abortOnError = false;
    qtlapi.callServer(ngOptions, ngProcProperties);
}

function dumpJson(jsonData) {
    console.log(jsonData);
}

// process NG properties list
let ngProcProperties = dumpJson;

function volSummary({startTime = '', endTime = '', range = 'self+children'}) {
    let ngOptions = qtlapi.buildAuth(cred.ngServer);
    ngOptions.path = `/cdn/properties?target=${target}&limit=${limit}`;
    ngOptions.headers['Report-Range']=range;
    ngOptions.abortOnError = false;
    qtlapi.callServer(ngOptions, ngProcProperties);
}

getProperties({limit:3});