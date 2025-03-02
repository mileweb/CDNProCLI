const { buildAuth, callServer, cdnpro } = require('../cdnpro-helper');
const { cred } = require('../SECRET_credentials');

function usage() {
    const scriptName = process.argv[1];
    console.log(`Usage: node ${scriptName} customerId action data`);
    console.log('  customerId: the customer ID');
    console.log('  action: one of addDirective, deleteDirective');
    console.log('  data: directives separated by comma');
}

async function main() {
    if (process.argv.length < 5) {
        usage();
        process.exit(1);
    }
    const customerId = process.argv[2];
    const action = process.argv[3];
    const data = process.argv[4].split(',');
    if (data.length === 0) {
        console.error('Error: directive list is empty');
        process.exit(1);
    }
    /* 
    step 0: get the customer info, display it, ask for confirmation
    step 1: get the serviceQuota for the customer ID, display it
    step 2: if action is addDirective, check if the directives are already in the serviceQuota
            throw error if any directive is already in the serviceQuota
            also check if the directives are in systemConfig
            if action is deleteDirective, check if the directives are in the serviceQuota
            throw error if any directive is not in the serviceQuota
    step 3: ask user to confirm the action
    step 4: update the serviceQuota by a PATCH request
    */
    cdnpro.setServerInfo(cred.cdnPro);
    const customer = await cdnpro.getCustomer(customerId);
    // copy a few fields to the customer object
    const customerInfo = {id:customer.customerId, name:customer.name, responsiblePerson:customer.responsiblePerson};
    console.log('Customer Info:', customerInfo);
    // ask for confirmation from console. Continue if yes, exit if no.
    let answer = await cdnpro.askQuestion('Continue? (y/n):');
    if (answer.toLowerCase() !== 'y') {
        console.log('Exiting ...');
        process.exit(0);
    }
    const sq = await cdnpro.getServiceQuota(customerId);
    const sc = await cdnpro.getSystemConfigs();
    const newSQ = {allowedCacheDirectives: Array.from(sq.allowedCacheDirectives)};
    // check if sq.allowedCacheDirectives includes the data
    if (action === 'addDirective') {
        for (let d of data) {
            if (newSQ.allowedCacheDirectives.includes(d)) {
                console.error(`Error: '${d}' is already in the serviceQuota`);
                process.exit(1);
            }
            if (sc.baseDirectives.includes(d)) {
                console.error(`Error: '${d}' is a base directive, no need to add to the serviceQuota`);
                process.exit(1);
            }
            if (!sc.advancedDirectives.includes(d)) {
                console.error(`Error: '${d}' is NOT a valid advanced directive in the systemConfig`);
                process.exit(1);
            }
            newSQ.allowedCacheDirectives.push(d);
        }
    } else if (action === 'deleteDirective') {
        for (let d of data) {
            if (!newSQ.allowedCacheDirectives.includes(d)) {
                console.error(`Error: '${d}' is NOT in the serviceQuota`);
                process.exit(1);
            }
            // remove the directive from the serviceQuota
            newSQ.allowedCacheDirectives = newSQ.allowedCacheDirectives.filter(x => x !== d);
        }
    } else {
        console.error('Error: action must be one of addDirective, deleteDirective');
        process.exit(1);
    }
    newSQ.allowedCacheDirectives.sort();
    // make a PATCH request to update the serviceQuota
    sq.allowedCacheDirectives.sort();
    const patch = cdnpro.diffArrays(sq.allowedCacheDirectives, newSQ.allowedCacheDirectives);
    console.log(patch);
    console.log(`allowedCacheDirectives before the change has ${sq.allowedCacheDirectives.length} items:`);
    console.log(`allowedCacheDirectives after the change has ${newSQ.allowedCacheDirectives.length} items:`);
    // ask for confirmation from console. Continue if yes, exit if no.
    answer = await cdnpro.askQuestion('Continue with the patch? (y/n):');
    if (answer.toLowerCase() !== 'y') {
        console.log('Exiting ...');
        process.exit(0);
    }
    await cdnpro.patchServiceQuota(sq.serviceQuotaId, newSQ);
    console.log('Service Quota has been updated.');
    const newSQ2 = await cdnpro.getServiceQuota(customerId);
    console.log('Allowed directives in new Service Quota:', newSQ2.allowedCacheDirectives);
    console.log(`has ${newSQ2.allowedCacheDirectives.length} items.`);
    process.exit(0);
}

main();