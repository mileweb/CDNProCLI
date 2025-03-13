let taskConfig = {
    customerId: 1234,   //required // work on this customer's properties
    includeChildren: true,  // include all child customer's properties
    operator: "Bin Ni",  //required // your name, will be recorded in the task description
    comments: "change quantil.com origins to auto directConnection", //required // comments about the task
    dbName: 'batchDB.json', //required // the JSON database file to store the work data
    batchLimit: 50, // the number of properties to process in one batch
    // a coarse filter to select candidate properties in the "find" stage
    findFilter: {hasConfig: 'origins.servers:quantil.com'},
    // exact criteria to select the properties to update
    // input is the property version obj, returns true or false
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
    // the input is a deep copy of the original property version
    // you can modify it directly and return it
    createVersion: function(nv) {
        for (o of nv.origins) {
            if (o.servers.some(s=>s.includes('quantil.com'))) {
                o.directConnection = 'auto';
            }
        }
        return nv; // return the new property version
    }
};

exports.taskConfig = taskConfig;