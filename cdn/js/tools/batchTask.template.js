let taskConfig = {
    // all fields are required: 
    // customerId, includeChildren, operator, comments, condition, createVersion
    customerId: 1234,    // work on this customer's properties
    includeChildren: true,  // include all child customer's properties
    operator: "Bin Ni",  // your name, will be recorded in the task
    comments: "change quantil.com origins to auto directConnection", // any comments, will be recorded too
    dbName: 'batchDB.json', // the JSON database file to store the work data
    batchLimit: 50, // the number of properties to process in one batch
    // a coarse filter to select candidate properties in the "find" stage
    findFilter: {hasConfig: 'origins.servers:quantil.com'},
    // exact criteria to select properties to update
    // input is the property version obj, returns true or false
    condition: function(pv) {
        // if the origin server contains quantil.com, and directConnect is not 'auto'
        if (pv.origins == null) return false;
        for (o of pv.origins) {
            if (o.servers.some(s=>s.includes('quantil.com')) && o.directConnection != 'auto') {
                return true;
            }
        }
        return false;
    },
    // returns a new property version based on the input property version
    createVersion: function(pv) {
        let nv = JSON.parse(JSON.stringify(pv)); // deep copy
        for (o of nv.origins) {
            if (o.servers.some(s=>s.includes('quantil.com'))) {
                o.directConnection = 'auto';
            }
        }
        return nv; // return the new property version
    }
};

exports.taskConfig = taskConfig;