const { cdnpro } = require('../cdnpro-helper');
const path = require('path');
const { cred } = require('../SECRET_credentials');

async function usage() {
    const absPath = process.argv[1];
    const relPath = path.relative(process.cwd(), absPath);
    const scriptName = absPath.length <= relPath.length ? absPath : relPath;
    console.log(`Usage:`);
    for (let f in cdnpro) {
        if (typeof cdnpro[f] === 'function' && (f.startsWith('get')||f.startsWith('list'))) {
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
    if (!cdnpro[func] || typeof cdnpro[func] !== 'function' || (!func.startsWith('get')&&!func.startsWith('list'))) {
        console.error('Error: function', func, 'not found');
        await usage();
        process.exit(1);
    }
    const argv = process.argv.slice(3).filter(a => !a.startsWith('-'));
    const cmdOpt = process.argv.slice(3).filter(a => a.startsWith('-'));
    let options = {};
    cmdOpt.forEach(async(o) => {
        if (o === '-nocache') {
            options.noCache = true;
        } else if (o === '-A') {
            options.includeChildren = true;
        } else if (o.startsWith('-i')) {
            options.onBehalfOf = parseInt(o.substring(2));
        } else if (o === '-d' || o === '--debug') {
            options.debug = true;
        } else if (o.startsWith('-l=')) { //limit
            options.limit = parseInt(o.substring(3));
        } else if (o.startsWith('-l')) { // time range of the last n sec/min/hour/day
            options.end = 'now';
            options.span = o.substring(2);
        } else if (o.startsWith('-o=')) { // offset
            options.offset = parseInt(o.substring(3));
        } else if (o.startsWith('-search=')) {
            options.search = o.substring(8);
        } else {
            console.error('Error: unknown option', o);
            process.exit(1);
        }
    });
    cdnpro.setServerInfo(cred.cdnPro);
    const funcHelp = await cdnpro[func]('--help');
    let result = null;
    if (argv.length < funcHelp.minArgs) {
        console.error('Error: function', func, `needs at least ${funcHelp.minArgs} argument:`);
        console.error(funcHelp.usage);
        process.exit(1);
    }
    result = await cdnpro[func]({argv:argv.slice(0, funcHelp.maxArgs), options});
    console.log(result);
    process.exit(0);
}

main();