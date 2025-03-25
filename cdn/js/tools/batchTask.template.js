let taskConfig = {
    customerId: 1234,   //required // work on this customer's properties
    includeChildren: true,  // include all child customer's properties
    operator: "Bin Ni",  //required // your name, will be recorded in the task description
    comments: "change quantil.com origins to auto directConnection", //required // comments about the task
    dbName: 'batchDB.json', //required // the JSON database file to store the work data
    batchLimit: 50, // the number of properties to process in one batch
    // a coarse filter to select candidate properties in the "find" stage
    findFilter: {hasConfig: 'origins.servers:quantil.com'},
    // The exact criteria to select the properties to update
    // input is the property version obj, returns true or false
    // It is required that the condition should NOT match the new property
    // version created by createVersion() below.
    condition: function(pv) {
        // if the origin server name contains quantil.com, and directConnect is not 'auto'
        if (pv.origins == null) return false;
        for (o of pv.origins) {
            if (o.servers.some(s=>s.includes('quantil.com')) && o.directConnection != 'auto') {
                return true;
            }
        }
        return false;
    },
    // The input is a deep copy of the original property version.
    // You can modify it directly and return as the new property version.
    // It is required that the new property version should NOT meet the condition() above.
    // This is to avoid the same property being processed multiple times.
    createVersion: function(nv) {
        for (o of nv.origins) {
            if (o.servers.some(s=>s.includes('quantil.com'))) {
                o.directConnection = 'auto';
            }
        }
        return nv; // return the new property version
    }
    //This is an example to replace a directive in the edge logic
    // createVersion: function(nv) {
    //     nv.edgeLogic = nv.edgeLogic.replace('old_directive', 'new_directive');
    //     return nv; // return the new property version
    // }
};

exports.taskConfig = taskConfig;