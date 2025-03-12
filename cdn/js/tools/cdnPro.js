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
            console.log(`node ${scriptName} ${f}`, help.usage);
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
    let argv = process.argv.slice(3).filter(a => !a.startsWith('-'));
    const cmdOpt = process.argv.slice(3).filter(a => a.startsWith('-'));
    let options = {verbose: 0};
    for (let o of cmdOpt) {
        if (o === '-nocache') {
            options.noCache = true;
        } else if (o.startsWith('-v=')) {
            options.verbose = parseInt(o.substring(3));
        } else if (o === '-v') {
            options.verbose = 1;
        } else if (o === '-A') {
            options.includeChildren = true;
        } else if (o.startsWith('-i')) {
            options.onBehalfOf = parseInt(o.substring(2));
        } else if (o === '-d' || o === '--debug') {
            options.debug = true;
        } else if (o.startsWith('-l=')) { //limit
            options.limit = parseInt(o.substring(3));
        } else if (o.startsWith('-limit=')) { //limit
            options.limit = parseInt(o.substring(7));
        } else if (o.startsWith('-l')) { // time range of the last n sec/min/hour/day
            options.end = 'now';
            options.span = o.substring(2);
        } else if (o.startsWith('-o=')) { // offset
            options.offset = parseInt(o.substring(3));
        } else if (o.startsWith('-type=')) { // type
            options.type = o.substring(6);
            if (options.type.startsWith('5')) {
                options.type = 'fiveminutes';
            }
        } else if (o.startsWith('-search=')) {
            options.search = o.substring(8);
        } else if (o.startsWith('-hasConfig=')) {
            options.hasConfig = o.substring(11);
        } else if (o.startsWith('-target=')) {
            options.target = o.substring(8);
        } else {
            console.error('Error: unknown option', o);
            process.exit(1);
        }
    };
    cdnpro.setServerInfo(cred.cdnPro);
    const funcHelp = await cdnpro[func]('--help');
    let result = null;
    if (argv.length < funcHelp.minArgs) {
        console.error('Error: function', func, `needs at least ${funcHelp.minArgs} argument:`);
        console.error(funcHelp.usage);
        process.exit(1);
    }
    argv = argv.slice(0, funcHelp.maxArgs);
    while (argv.length < funcHelp.maxArgs) {
        argv.push(null);
    }
    argv.push(options);
    result = await cdnpro[func].apply(null, argv);
    if (options.verbose > 1)
        console.log(JSON.stringify(result, null, 2));
    else console.log(result);
    process.exit(0);
}

main();