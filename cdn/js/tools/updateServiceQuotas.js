const { buildAuth, callServer, cdnpro } = require('../cdnpro-helper');
const { cred } = require('../SECRET_credentials');

function usage() {
    const scriptName = process.argv[1];
    console.log(`Usage: node ${scriptName} customerId action data`);
    console.log('  customerId: the customer ID');
    console.log('  action: one of addDirective, deleteDirective');
    console.log('  data: directives separated by comma');
    console.log('Example: node', scriptName, '1234 addDirective', 'directive1,directive2');
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
    const patchObj = {};
    /*
    step 1: get the serviceQuota for the customer ID, display it
    step 2: if action is addDirective, check if the directives are already in the serviceQuota
            throw error if any directive is already in the serviceQuota
            also check if the directives are in systemConfig
            if action is deleteDirective, check if the directives are in the serviceQuota
            throw error if any directive is not in the serviceQuota
    */
    const updateAllowedDirectives = function() {
        patchObj.allowedCacheDirectives = Array.from(sq.allowedCacheDirectives);
        // check if sq.allowedCacheDirectives includes the data
        if (action === 'addDirective') {
            for (let d of data) {
                if (patchObj.allowedCacheDirectives.includes(d)) {
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
                patchObj.allowedCacheDirectives.push(d);
            }
        } else if (action === 'deleteDirective') {
            for (let d of data) {
                if (!patchObj.allowedCacheDirectives.includes(d)) {
                    console.error(`Error: '${d}' is NOT in the serviceQuota`);
                    process.exit(1);
                }
                // remove the directive from the serviceQuota
                patchObj.allowedCacheDirectives = patchObj.allowedCacheDirectives.filter(x => x !== d);
            }
        } else {
            console.error('Error: action must be one of addDirective, deleteDirective');
            process.exit(1);
        }
        patchObj.allowedCacheDirectives.sort();
        sq.allowedCacheDirectives.sort();
        // display the diff between the original and the new serviceQuota
        const diffTxt = cdnpro.diffObjects(sq.allowedCacheDirectives, patchObj.allowedCacheDirectives);
        console.log('Changes being made to allowedCacheDirectives:');
        console.log(diffTxt);
        console.log(`Items before the change: ${sq.allowedCacheDirectives.length}`);
        console.log(`Items after the change: ${patchObj.allowedCacheDirectives.length}`);
    } // end of updateAllowedDirectives()
    if (action === 'addDirective' || action === 'deleteDirective') {
        updateAllowedDirectives();
    }
    // step 3: ask user to confirm the action
    answer = await cdnpro.askQuestion('Continue with the change? (y/n):');
    if (answer.toLowerCase() !== 'y') {
        console.log('Exiting ...');
        process.exit(0);
    }
    // step 4: update the serviceQuota by a PATCH request
    await cdnpro.patchServiceQuota(sq.serviceQuotaId, patchObj);
    console.log(`Service Quota for customer ${customerId} has been updated.`);
    const newSQ = await cdnpro.getServiceQuota(customerId, {noCache:true});
    console.log(`There are ${newSQ.allowedCacheDirectives.length} allowedCacheDirectives now.`);
    const newObj = {};
    for (let k in patchObj) { //copy the updated fields to newObj
        newObj[k] = newSQ[k];
    }
    const diffTxt = cdnpro.diffObjects(patchObj, newObj);
    if (diffTxt.length === 0) {
        console.log('The update is verified to be exactly as expected.');
    } else {
        console.error('Error: The update is NOT as expected.');
        console.error(diffTxt);
    }
    process.exit(0);
}

main();