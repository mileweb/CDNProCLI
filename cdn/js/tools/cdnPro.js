const { buildAuth, callServer, cdnpro } = require('../cdnpro-helper');
const { cred } = require('../SECRET_credentials');

function usage() {
    const scriptName = process.argv[1];
    console.log(`Usage: node ${scriptName} function data`);
    console.log('  function: the function name to call, one of:');
    for (let f in cdnpro) {
        if (typeof cdnpro[f] === 'function' && f.startsWith('get')) {
            console.log('    ', f);
        }
    }
    console.log('  data: parameters for the function');
    console.log('Example: node', scriptName, 'getCustomer', '123');
}

async function main() {
    if (process.argv.length < 3) {
        usage();
        process.exit(1);
    }
    const func = process.argv[2];
    const data = process.argv[3];
    if (!cdnpro[func] || typeof cdnpro[func] !== 'function' || !func.startsWith('get')) {
        console.error('Error: function', func, 'not found');
        usage();
        process.exit(1);
    }
    cdnpro.setServerInfo(cred.cdnPro);
    const result = await cdnpro[func](data);
    console.log(result);
    process.exit(0);
}

main();