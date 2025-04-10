/*
 This is a tool that scans all the production properties of a customer.
 It finds all the properties that meet a certain condition,
 creates a new version based on the production version, validate and deploy to production.
 The actual condition and new version creation are defined in the taskConfig, which is a js file.
 To avoid mistakes, the tool is designed to run in 4 steps:
 1. (find) find a candidate list of the currently deployed properties, save to a json DB file
 2. (check) load each of candidate property version in production to make sure if the condition is met
 3. (new) generate the new version locally, show diff, get approval to create on server, then validate
 4. (deploy) deploy the validated new versions in batch. Right before the deployment, make sure the
    deployed versions are not changed

Usage: node batchUpdateProperties.js taskName find|check|new|deploy
    taskName: the name of the task, which is a js file in the same directory

Consult the batchTask.template.js for the taskConfig format.
*/

const fs = require('fs');
const { cdnpro } = require('../cdnpro-helper');
const { cred } = require('../SECRET_credentials');
const { resolve } = require('path');
//convert process.argv[2] from a relative path to an absolute path
const taskFileName = resolve(process.cwd(), process.argv[2]);
const { taskConfig } = require(taskFileName);

//const testPV = JSON.parse(fs.readFileSync('pv.json')).configs;
const stepName = process.argv[3];
let dbName = taskConfig.dbName;
let updateN = taskConfig.batchLimit || 9999; //number of properties to change.
if (dbName == null) {
    console.error('Error: dbName is not defined in the taskConfig.');
    process.exit(1);
}

// a global semaphore to control the number of concurrent tasks
const sema = {
    cnt:0, max:3,
    resolve: null,
    cleanResolve: null,
    config: function(max) {
        if (this.cnt||this.resolve||this.cleanResolve) throw new Error('semaphore is in use!');
        this.max = max;
//        console.log(`semaphore max is configured to ${max}`);
    },
    acquire: async function() {
        if (this.cnt < this.max) this.cnt ++;
        else {
            //console.log('semorphore is full, waiting ...');
            return new Promise(resolve => this.resolve = resolve);
        }
    },
    release: function() {
        if (this.resolve) {
            this.resolve();
            this.resolve = null;
        } else if (this.cnt == 0) {
            throw new Error('semorphore is empty!');
        } else {
            this.cnt --;
            if (this.cnt == 0 && this.cleanResolve) {
                this.cleanResolve();
                this.cleanResolve = null;
            }
        }
    },
    allDone: async function() {
        if (this.cnt == 0) return;
        return new Promise(resolve => this.cleanResolve = resolve);
    }
};

let properties = [];
/* element fields:
id: property ID
name: property name
cid: owner customer ID
prodVer: production version number
condition: true/false if condition is met
prodVerConfig: production property version
newVer: new version number
error: error message during the process
newVerConfig: new property version
validId: validation ID
newVerValidated: true/false
newVerDeployed: true/false
deploymentTaskId:
*/
async function main() {
    cdnpro.setServerInfo(cred.cdnPro);
    switch (stepName) {
    case 'reset' : fs.unlinkSync(dbName); break;
    case 'find'  : await findProperties(); break;
    case 'check' : await checkProperties(2); break;
    case 'check-f' : await checkProperties(2, true); break; //force check
    case 'new'   : await newProperties(2); break;
    case 'new-f'   : await newProperties(2, true); break; //force new
    case 'deploy': await deployProperties(); break;
    case 'test': testConfig(); break;
    default : console.error('Wrong step name.');
        console.error('Usage: node batchUpdateProperties.js task find|check|new|deploy');
        process.exit(1);
        break;
    }
    process.exit(0);
}

main();

function saveDB(msg) {
    if (msg) console.log(msg);
    fs.writeFileSync(dbName, JSON.stringify(properties, null, 2));
}

function testConfig() {
    taskConfig.createVersion(testPV);
    console.log(testPV);
}

/*///////////////////////////// Find Properties /////////////////////////////////
populates fields: id, name, cid, prodVer
*/
async function findProperties() {
    try {
        properties = JSON.parse(fs.readFileSync(dbName));
        console.log(`loaded ${properties.length} properties from ${dbName}`);
    } catch (e) {
        console.log(`${dbName} does not exist, creating ...`);
    }
    const limit = 200;
    const options = {onBehalfOf:taskConfig.customerId, includeChildren:taskConfig.includeChildren, 
        limit, offset:0, target:'production', ...taskConfig.findFilter};
    let propList = null;
    const findStatus = {cnt:0, newCnt:0, newVerCnt:0, deployed:0,
        unmatchedCnt:0, errCnt:0};
    do {
        propList = await cdnpro.listProperties(options);
        console.log(`got ${propList.properties.length} properties from offset=${options.offset} out of ${propList.count} ...`);
        propList.properties.forEach(x => {
            let p = properties.find(y=>y.id==x.id);
            if (p == null) {
                findStatus.newCnt ++;
                properties.push({
                    id:x.id,
                    name:x.name,
                    cid:x.customerId||taskConfig.customerId,
                    prodVer: x.productionVersion.version
                });
            } else {
                if (p.prodVer != x.productionVersion.version) {
                    if (p.newVer != x.productionVersion.version) {
                        findStatus.newVerCnt ++;
                        console.log(`property ${x.id} has a new version ${x.productionVersion.version} in production, NOT deployed by me!!!`);
                    } else {
                        findStatus.deployed ++;
                        console.log(`property ${x.id} has a new version ${x.productionVersion.version} in production, deployed by me.`);
                    }
                }
                if (p.error) {
                    findStatus.errCnt ++;
                }
                if (p.condition === false) {
                    findStatus.unmatchedCnt ++;
                }
            }
        }); //forEach
        findStatus.cnt += propList.properties.length;
        options.offset += limit;
    } while (options.offset < propList.count);

    console.log(`found ${findStatus.cnt} properties, ${findStatus.newCnt} are new.`);
    console.log(`${findStatus.newVerCnt} have new version deployed by others`);
    console.log(`${findStatus.deployed} have new version deployed by me.`);
    console.log(`${findStatus.errCnt} have errors.`);
    console.log(`${findStatus.unmatchedCnt} do not match condition.`);

    if (findStatus.cnt > 300) {
        throw new Error(`Too many properties, please set or refine findFilter in ${process.argv[2]}`);
    }
    if (findStatus.newCnt) {
        saveDB(`saving the properties to ${dbName}`);
    }
}

/* ////////////////////////////// Check Property /////////////////////////////////
try to find up to updateN properties that match the condition
populates fields: condition, prodVerConfig, newVerConfig, error
*/
async function checkProperties(concurrency, force) {
    properties = JSON.parse(fs.readFileSync(dbName));
    console.log(`loaded ${properties.length} properties from ${dbName}`);

    sema.config(concurrency);
    let matched = 0, cnt = 0, checked = 0;
    for (let ind = 0; ind < properties.length; ind ++) {
        if (matched >= updateN) break;
        let p = properties[ind];
        if (p.condition != null && !force) {
            checked ++;
            continue;
        }
        await sema.acquire();
        const prom = cdnpro.getPropertyVersion(p.id, p.prodVer, {onBehalfOf:p.cid});
        prom.then(rpv => {
            sema.release();
            cnt ++;
            //sanity check
            if (p.prodVer != rpv.version || rpv.status.inProduction != true) {
                throw new Error('got wrong property version of ${p.id}!');
            }
            const pv = rpv.configs;
            p.prodVerConfig = pv;
            try {
                if (taskConfig.condition(pv)) {
                    console.log(`property ${p.id} version ${p.prodVer} matched!`);
                    p.condition = true;
                    p.prodVerConfig = pv;
                    const deepCopy = JSON.parse(JSON.stringify(pv));
                    p.newVerConfig = taskConfig.createVersion(deepCopy);
                    p.newVerConfig.description = `cloned from version ${p.prodVer} by ${taskConfig.operator}, ${taskConfig.comments}`;
                    if (taskConfig.condition(p.newVerConfig)) {
                        console.error(`Error: new version of property ${p.id} version ${p.prodVer} still matches the condition!`);
                        console.error(p.newVerConfig);
                        console.error('Please refine the createVersion function in the taskConfig.');
                        process.exit(1);
                    }
                    matched ++;
                } else {
                    console.log(`property ${p.id} version ${p.prodVer} did NOT match.`);
                    p.condition = false;
                    //p.prodVerConfig = undefined;
                }
                p.newVer = undefined;
                p.validId = undefined;
                p.newVerValidated = undefined;
            } catch (e) {
                console.log(`Error: checking property ${p.id} version ${p.prodVer}: ${e.message}!`);
                p.condition = false;
                p.error = e.message;
            }
        }).catch(e => {
            throw new Error(`Error: getting property ${p.id} version ${p.prodVer}: ${e.message}!`);
        });
    }
    await sema.allDone();
    if (cnt > 0) {
        console.log(`checked ${cnt} properties, found ${matched} matched.`);
        saveDB(`saving the properties to ${dbName}`);
    } else {
        if (checked == properties.length) {
            console.log('All properties have been checked before.');
        } else {
            console.log('No properties to be checked.');
        }
    }
}

/*///////////////////////////// Create new version /////////////////////////////////
populates fields: newVer, validId, newVerValidated, error
*/
async function newProperties(concurrency, force) {
    properties = JSON.parse(fs.readFileSync(dbName));
    console.log(`loaded ${properties.length} properties from ${dbName}`);
    //doNew({ind:0, cnt:0});
    let cnt = 0, validated = 0;
    sema.config(concurrency);
    console.outBuffer = []; //buffer the console output during the question
    for (let ind = 0; ind < properties.length; ind ++) {
        let p = properties[ind];
        if ((p.newVerValidated != null && !force)|| p.condition === false || p.error) {
            validated ++;
            continue;
        }
        //found a property to be updated
        if (p.newVerConfig == null) { //sanity check
            p.error = `new version is empty for property ${p.id}.`;
            console.log(`Error: ${p.error}`);
            continue;
        }
        //create new version
        if (p.newVer == null) { //no new version yet
            const stringifyReplacer = function(key, value) {
                if ((key === 'edgeLogic'|| 
                      key === 'loadBalancerLogic' ||
                      key === 'format') && typeof value === 'string') {
                    return value.split('\n'); //split the string into lines
                } else {
                    return value;
                }
            };
            const str1 = JSON.stringify(p.prodVerConfig, stringifyReplacer, 2);
            const str2 = JSON.stringify(p.newVerConfig, stringifyReplacer, 2);
            //console.log(str1, str2);
            const diff = cdnpro.diffLines(str1, str2);
            console.log('---------------------');
            console.log(`property ${p.id} version ${p.prodVer} diff:`);
            console.log(diff);
            const answer = await cdnpro.askQuestion('Do you want to create a new version for this property? (y/n):');
            if (console.outBuffer.length) {
                console.log(console.outBuffer.join('\n'));
                console.outBuffer = [];
            }
            if (answer != 'y') {
                console.log(`property ${p.id} version ${p.prodVer} skipped.`);
                continue;
            }
            //create new version
            let ngOptions = cdnpro.buildAuth();
            ngOptions.path = `/cdn/properties/${p.id}/versions`;
            ngOptions.method = 'POST';
            ngOptions.headers['On-Behalf-Of']=`${p.cid}`;
            ngOptions.headers['Content-Type']='application/json; charset=UTF-8';
            ngOptions.reqBody = JSON.stringify(p.newVerConfig);
            console.log(`Creating property ${p.id} new version ...`);
            const {obj, ctx} = await cdnpro.callServer(ngOptions);
            let newVNum = 0;
            if (!ctx.err && ctx._res.statusCode == 201) {
                const loc = ctx._res.headers['location']||'';
                const i = loc.indexOf('/versions/');
                // 10 = length of '/versions/'
                if (i > -1 && i+10<loc.length) {
                    newVNum = Number(loc.substr(i+10));
                }
            }
            if (newVNum == 0) {
                p.error = `failed to create new version for ${p.id}. `;
                if (ctx.err) p.error += `error = ${ctx.err.message}`;
                else p.error += `status=${ctx._res.statusCode}`;
                console.error("Error:", p.error);
                console.error(obj);
                console.log(`Aborted with ${cnt} new property versions.`);
                process.exit(1);
            }
            p.newVer = newVNum;
            p.validId = undefined
            saveDB(`created new version ${p.newVer} for property ${p.id}, saving to ${dbName}`);
        }
        //validate the new version
        await sema.acquire();
        p.newVerValidated = undefined;
        p.deploymentTaskId = undefined;
        p.newVerDeployed = undefined;

        if (force) p.validId = undefined;
        if (p.validId == null) { //not validated yet
            //Create validation task
            let ngOptions = cdnpro.buildAuth();
            ngOptions.path = `/cdn/validations`;
            ngOptions.method = 'POST';
            ngOptions.headers['On-Behalf-Of']=`${p.cid}`;
            ngOptions.headers['Content-Type']='application/json; charset=UTF-8';
            ngOptions.reqBody = JSON.stringify({
                name:`validate property ${p.id} version ${p.newVer}, ${taskConfig.comments}`,
                propertyId:p.id,version:p.newVer});
            console.log(`validating property ${p.id} new version ${p.newVer} ...`);
            const {obj, ctx} = await cdnpro.callServer(ngOptions);
            let newVNum = 0;
            if (!ctx.err && ctx._res.statusCode == 201) {
                const loc = ctx._res.headers['location']||'';
                const i = loc.indexOf('/validations/');
                if (i > -1 && i+13<loc.length) {
                    newVNum = loc.substr(i+13);
                }
            }
            if (newVNum == 0) {
                p.error = `failed to start validation for new version for ${p.id}`;
                if (ctx.err) p.error += `error = ${ctx.err.message}`;
                else p.error += `status=${ctx._res.statusCode}`;
                console.error("Error:", p.error);
                console.error(obj);
                console.error(`Aborted with ${cnt} new property versions.`);
                process.exit(1);
            }
            p.validId = newVNum;
            saveDB(`created validation id for property ${p.id} new version ${p.newVer}, saving to ${dbName}`);
            setTimeout(checkValidationAsync, 30000, p); //check the validation status after 30s,
                                                        //release the semaphore when done
        } else { // already have a validation task ID, check the status now
            console.log(`found validation ID for property ${p.id} new version ${p.newVer} ...`);
            checkValidationAsync(p);
        }
        cnt ++;
        if (cnt > updateN) break;
    }
    if (cnt > 0) {
        console.log(`Created ${cnt} new property versions. Waiting for validations ...`);
        await sema.allDone();
        saveDB(`Finished validating ${cnt} new property versions, saving to ${dbName}`);
    } else {
        if (validated == properties.length) {
            console.log('All new property versions have been validated before.');
        } else {
            console.log('No new property version created or validated.');
        }
    }
}

async function checkValidationAsync(p) {
    let ngOptions = cdnpro.buildAuth();
    ngOptions.headers['On-Behalf-Of']=`${p.cid}`;
    ngOptions.path = `/cdn/validations/${p.validId}`;
    const {obj, ctx} = await cdnpro.callServer(ngOptions);
    if (ctx.error) {
        p.error = `validation of property ${p.id} version ${p.newVer} timed out.`;
        console.error("Error:", p.error);
        console.error(obj);
        saveDB(`Aborted task, saving to ${dbName}`);
        process.exit(1);
    }else if (obj.status==='waiting'||obj.status==='in progress') {
        if (!cdnpro.isWaitingQuestion()) { //avoid clusting the console
            console.log(`property ${p.id} new version ${p.newVer} validation is in progress ...`);
        }
        setTimeout(checkValidationAsync, 10000, p);
    }else if (obj.status==='succeeded') {
        p.newVerValidated = true;
        saveDB(null);
        const msg = `property ${p.id} new version ${p.newVer} validated!`;
        if (!cdnpro.isWaitingQuestion()) { //avoid clusting the console
            console.log(msg);
        } else {
            console.outBuffer.push(msg);
        }
        sema.release();
    } else {
        p.newVerValidated = false;
        p.error = `validation of property ${p.id} version ${p.newVer} failed.`;
        console.error("Error:", p.error);
        console.error(obj);
        saveDB(`Aborted task, saving to ${dbName}`);
        process.exit(1);
    }
}

/*///////////////////////////// Deploy new version /////////////////////////////////
deploy properties for each customer in a batch no more than updateN
populates fields: newVerDeployed, deploymentTaskId, error
*/
async function deployProperties() {
    properties = JSON.parse(fs.readFileSync(dbName));
    console.log(`loaded ${properties.length} properties from ${dbName}`);
    let cid = null;
    let cnt = 0;
    let reqBody = {actions:[],target:'production'};
    let pList = [];
    for (let ind = 0; ind < properties.length; ind ++) {
        let p = properties[ind];
        if (p.newVerValidated && p.newVerDeployed == null && !p.error &&
            (cid === null || p.cid === cid)) {
            cid = p.cid;
            reqBody.actions.push({action:'deploy_property', propertyId:p.id, version:p.newVer});
            pList.push(p);
            cnt ++;
            if (cnt == updateN) break;
        }
    }
    if (cnt == 0) {
        console.log('no properties to be deployed.');
        return;
    }
    let newDNum = '';
    sema.config(1); //deploy one customer at a time
    if (pList.some(p=>(!!p.deploymentTaskId))) { //if some properties are already being deployed
        newDNum = pList[0].deploymentTaskId;
        if (pList.some(p=>p.deploymentTaskId != newDNum)) {
            console.error('Error: properties to be deployed have different deploymentTaskId.');
            process.exit(1);
        }
        console.log(`properties to be deployed have the same deploymentTaskId ${newDNum}.`);
        console.log('Checking deployment status ...');
        await sema.acquire();
        checkDeploymentStatus(pList);
    } else { //create a new deployment task
        reqBody.name = `deploy ${cnt} properties, ${taskConfig.comments}`;
        console.log(`found ${cnt} properties of customer ${cid} to be deployed.`, reqBody);
        let answer = await cdnpro.askQuestion('Do you want to deploy these properties? (y/n):');
        if (answer != 'y') {
            console.log('Aborted.');
            return;
        }
        //double check no others deployed new versions
        console.log('Double checking production versions ...');
        const latestPropList = await cdnpro.listProperties({onBehalfOf:taskConfig.customerId,
            includeChildren:taskConfig.includeChildren, target:'production', ids:pList.map(p=>p.id)});
        for (let p of pList) {
            let x = latestPropList.properties.find(y=>y.id==p.id);
            if (x.productionVersion.version != p.prodVer) {
                console.error(`Error: property ${p.id} has a new version ${x.productionVersion.version} in production, different from version ${p.prodVer} in the DB.`);
                process.exit(1);
            }
        }
        console.log('All properties are still at the same version in production.');
        //Create deployment task
        const ngOptions = cdnpro.buildAuth();
        ngOptions.method = 'POST';
        ngOptions.headers['On-Behalf-Of']=`${cid}`;
        ngOptions.headers['Content-Type']='application/json; charset=UTF-8';
        ngOptions.path = `/cdn/deploymentTasks`;
        ngOptions.reqBody = JSON.stringify(reqBody);
        console.log('deploying ...');
        const {obj, ctx} = await cdnpro.callServer(ngOptions);
        
        if (!ctx.err && ctx._res.statusCode == 201) {
            const loc = ctx._res.headers['location']||'';
            const i = loc.indexOf('/deploymentTasks/');
            if (i > -1 && i+17<loc.length) {
                newDNum = loc.substr(i+17);
            }
        }
        if (newDNum === '') {
            console.error(`Error: failed to create deploymentTask for ${pList.length} properties.`);
            if (ctx.err) console.error(`${ctx.err.message}`);
            else {
                console.error(`status=${ctx._res.statusCode}`);
                console.error(obj); //show error details
            }
            process.exit(1);
        }
        let dispList = [];
        for (let p of pList) {
            p.deploymentTaskId = newDNum;
            dispList.push({id:p.id, ver:p.newVer, name:p.name});
        }
        console.log(`Successfully created deploymentTasks/${newDNum} for:`);
        console.log(dispList);
        saveDB(`Tried to deploy ${pList.length} properties, saving results to ${dbName}`);
        //check deployment status
        await sema.acquire();
        console.log('Checking deployment status ...');
        setTimeout(checkDeploymentStatus, 25000, pList);
    }
    await sema.allDone();
}

async function checkDeploymentStatus(pList) {
    let ngOptions = cdnpro.buildAuth();
    ngOptions.path = `/cdn/deploymentTasks/${pList[0].deploymentTaskId}`;
    ngOptions.headers['On-Behalf-Of']=`${pList[0].cid}`;
    const {obj, ctx} = await cdnpro.callServer(ngOptions);
    if (ctx.error) {
        console.error(`Error: checking deployment status of ${pList[0].deploymentTaskId}: ${ctx.error.message}`);
        process.exit(1);
    }
    if (obj.status === 'waiting' || obj.status === 'inprogress') {
        console.log(`deployment task ${pList[0].deploymentTaskId} is in progress ...`);
        setTimeout(checkDeploymentStatus, 10000, pList);
    } else if (obj.status === 'succeeded') {
        console.log(`deployment task ${pList[0].deploymentTaskId} succeeded!`);
        pList.forEach(p => p.newVerDeployed = true);
        saveDB(`Deployed ${pList.length} properties, saving to ${dbName}`);
        sema.release();
    } else {
        console.error(`Error: deployment task ${pList[0].deploymentTaskId} failed!`);
        console.error(obj);
        process.exit(1);
    }
}
