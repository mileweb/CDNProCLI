const { cdnpro } = require('../cdnpro-helper');
const { cred } = require('../SECRET_credentials');

function usage() {
    const scriptName = process.argv[1];
    console.log(`Usage: node ${scriptName} action data`);
    console.log('  action: one of addBaseDirectives, deleteBaseDirectives');
    console.log('                 addAdvancedDirectives, deleteAdvancedDirectives');
    console.log('                 addExperimentalDirectives, deleteExperimentalDirectives');
    console.log('  data: directives separated by comma');
    console.log('Example: node', scriptName, 'addExperimentalDirectives', 'directive1,directive2');
}

async function main() {
    if (process.argv.length < 4) {
        usage();
        process.exit(1);
    }
    const action = process.argv[2];
    const data = process.argv[3].split(',');
    if (data.length === 0) {
        console.error('Error: directive list is empty');
        process.exit(1);
    }
    cdnpro.setServerInfo(cred.cdnPro); // set the server info
    const sc = await cdnpro.getSystemConfigs();
    const patchObj = {};
    const field = action.indexOf('Base') != -1 ? 'baseDirectives' : 'advancedDirectives';
    const ADV_EXP_DIV = 'VVVVVVVVVVVVVV_Experimental_Below_VVVVVVVVVVVVVVVV';
  
    if (action === 'addBaseDirectives') {
        patchObj[field] = Array.from(sc[field]);
        for (let d of data) {
            if (patchObj.baseDirectives.includes(d)) {
                console.error(`Error: '${d}' is already in baseDirectives`);
                process.exit(1);
            }
            if (sc.advancedDirectives.includes(d)) {
                console.error(`Error: '${d}' is in advancedDirectives, cannot add to baseDirectives`);
                process.exit(1);
            }
            patchObj.baseDirectives.push(d);
        }
        patchObj.baseDirectives.sort();
        sc.baseDirectives.sort();
    } else if (action === 'deleteBaseDirectives') {
        patchObj[field] = Array.from(sc[field]);
        for (let d of data) {
            const index = patchObj.baseDirectives.indexOf(d);
            if (index === -1) {
                console.error(`Error: '${d}' is not in baseDirectives`);
                process.exit(1);
            }
            patchObj.baseDirectives.splice(index, 1);
        }
        patchObj.baseDirectives.sort();
        sc.baseDirectives.sort();
    } else {
        const divIdx = sc[field].indexOf(ADV_EXP_DIV);
        //get sub-array from 0 to divIdx-1
        const advDirList = sc[field].slice(0, divIdx).sort();
        const expDirList = sc[field].slice(divIdx + 1).sort();
        sc.advancedDirectives = advDirList.concat([ADV_EXP_DIV], expDirList);
        let checkAdvDirUsers = async function(d) {
            const svcQuotas = await cdnpro.listServiceQuotas({includeChildren:true, allowedCacheDirectives: d});
            if (svcQuotas.count > 0) {
                const cids = svcQuotas.serviceQuotaList.map(x => x.customerId);
                const result = await cdnpro.listCustomers({ids:cids});
                console.error(`Error: '${d}' is in ${svcQuotas.count} serviceQuotas. Here is the customer list:`);
                console.error(result.customers.map(c => {return {customerId:c.customerId, name:c.name}} ));
                console.error('Please remove the directive from the serviceQuotas first.');
                console.error(`For example, you cann call 'node updateServiceQuotas.js ${cids[0]} deleteDirective ${d}'`);
                process.exit(1);
            }
        }
        if (action === 'addAdvancedDirectives') {
            const advancedDirectives = Array.from(advDirList);
            for (let d of data) {
                if (advancedDirectives.includes(d)) {
                    console.error(`Error: '${d}' is already in advancedDirectives`);
                    process.exit(1);
                }
                if (sc.baseDirectives.includes(d)) {
                    console.error(`Error: '${d}' is in baseDirectives, cannot add to advancedDirectives`);
                    process.exit(1);
                }
                if (expDirList.includes(d)) {
                    console.error(`Error: '${d}' is in experimental Directives, cannot add to advancedDirectives`);
                    process.exit(1);
                }
                advancedDirectives.push(d);
            }
            advancedDirectives.sort();
            patchObj[field] = advancedDirectives.concat([ADV_EXP_DIV], expDirList);
        } else if (action === 'deleteAdvancedDirectives') {
            const advancedDirectives = Array.from(advDirList);
            for (let d of data) {
                const index = advancedDirectives.indexOf(d);
                if (index === -1) {
                    console.error(`Error: '${d}' is not in advancedDirectives`);
                    process.exit(1);
                }
                await checkAdvDirUsers(d);
                advancedDirectives.splice(index, 1);
            }
            advancedDirectives.sort();
            patchObj[field] = advancedDirectives.concat([ADV_EXP_DIV], expDirList);
        } else if (action === 'addExperimentalDirectives') {
            const experimentalDirectives = Array.from(expDirList);
            for (let d of data) {
                if (experimentalDirectives.includes(d)) {
                    console.error(`Error: '${d}' is already in experimentalDirectives`);
                    process.exit(1);
                }
                if (sc.baseDirectives.includes(d)) {
                    console.error(`Error: '${d}' is in baseDirectives, cannot add to experimentalDirectives`);
                    process.exit(1);
                }
                if (advDirList.includes(d)) {
                    console.error(`Error: '${d}' is in advanced Directives, cannot add to experimentalDirectives`);
                    process.exit(1);
                }
                experimentalDirectives.push(d);
            }
            experimentalDirectives.sort();
            patchObj[field] = advDirList.concat([ADV_EXP_DIV], experimentalDirectives);
        } else if (action === 'deleteExperimentalDirectives') {
            const experimentalDirectives = Array.from(expDirList);
            for (let d of data) {
                const index = experimentalDirectives.indexOf(d);
                if (index === -1) {
                    console.error(`Error: '${d}' is not in experimentalDirectives`);
                    process.exit(1);
                }
                await checkAdvDirUsers(d);
                experimentalDirectives.splice(index, 1);
            }
            experimentalDirectives.sort();
            patchObj[field] = advDirList.concat([ADV_EXP_DIV], experimentalDirectives);
        } else {
            console.error('Error: action must be one of {add/delete}{Base/Advanced/Experimental}Directives');
            process.exit(1);
        }
    } // end of action check

    let diffTxt = cdnpro.diffObjects(sc[field], patchObj[field]);
    console.log(`Changes being made to ${field}:`);
    console.log(diffTxt);
    console.log(`Current items: ${sc[field].length}`);
    console.log(`Future  items: ${patchObj[field].length}`);
    console.log(patchObj);
    const answer = await cdnpro.askQuestion('Continue with the change? (y/n):');
    if (answer.toLowerCase() !== 'y') {
        console.log('Exiting ...');
        process.exit(0);
    }
    await cdnpro.patchSystemConfigs(patchObj);
    console.log('systemConfig has been updated! Trying to verify ...');
    const newSC = await cdnpro.getSystemConfigs({noCache:true});
    console.log(`There are ${newSC[field].length} ${field} now.`);
    const newObj = {};
    if (field === 'baseDirectives') {
        newObj[field] = newSC[field].sort();
    } else {
        const divIdx = newSC[field].indexOf(ADV_EXP_DIV);
        const advDirList = newSC[field].slice(0, divIdx).sort();
        const expDirList = newSC[field].slice(divIdx + 1).sort();
        newObj[field] = advDirList.concat([ADV_EXP_DIV], expDirList);
    }
    diffTxt = cdnpro.diffObjects(patchObj, newObj);
    if (diffTxt.length === 0) {
        console.log('The update is verified to be exactly as expected.');
    } else {
        console.error('Error: The update is NOT as expected.');
        console.error(diffTxt);
    }
    process.exit(0);
}

main();