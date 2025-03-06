const { buildAuth, callServer, cdnpro } = require('../cdnpro-helper');
const path = require('path');
const { cred } = require('../SECRET_credentials');

async function usage() {
    const absPath = process.argv[1];
    const relPath = path.relative(process.cwd(), absPath);
    const scriptName = absPath.length <= relPath.length ? absPath : relPath;
    console.log(`Usage:`);
    for (let f in cdnpro) {
        if (typeof cdnpro[f] === 'function' && f.startsWith('get')) {
            let help = await cdnpro[f]('--help');
            console.log(`node ${scriptName}`, help.usage);
        }
    }
    console.log('Example: node', scriptName, 'getCustomer', '123');
}

async function main() {
    if (process.argv.length < 3) {
        await usage();
        process.exit(1);
    }
    const func = process.argv[2];
    if (!cdnpro[func] || typeof cdnpro[func] !== 'function' || !func.startsWith('get')) {
        console.error('Error: function', func, 'not found');
        await usage();
        process.exit(1);
    }
    cdnpro.setServerInfo(cred.cdnPro);
    const funcHelp = await cdnpro[func]('--help');
    let result = null;
    if (funcHelp.minArgs == 0)
        result = await cdnpro[func]();
    else if (funcHelp.minArgs == 1)
        result = await cdnpro[func](process.argv[3]);
    else if (funcHelp.minArgs == 2)
        result = await cdnpro[func](process.argv[3], process.argv[4]);
    else if (funcHelp.minArgs == 3)
        result = await cdnpro[func](process.argv[3], process.argv[4], process.argv[5]);
    else {
        console.error('Error: function', func, 'needs too many arguments');
        await usage();
        process.exit(1);
    }
    console.log(result);
    process.exit(0);
}

main();