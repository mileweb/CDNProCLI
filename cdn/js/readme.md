# Overview

This document describes the JavaScript library for managing the CDNetworks [CDN Pro service](https://www.cdnetworks.com/cdnpro/).

The [cdnpro-helper.js](cdnpro-helper.js) file contains the helper functions to generate the dynamic password, facilitate the HTTPS request and parse the response.

# Get Started
1. Clone the latest files using the following command:
```
git clone https://github.com/mileweb/CDNProCLI.git
```
2. go to the js directory and install the required packages:
```
cd CDNProCLI/cdn/js
npm install xml2js diff
```
3. Create a file to include the API credentials, for exmaple `SECRET_credential.js`. Open a text editor and put the following content into the file:
```Javascript
const cred = {
  "cdnPro" : { 
    "host" : "ngapi.cdnetworks.com",
    "user" : "{API USER NAME}",
    "secretKey" : "{SECRET API KEY}"
  }
}
exports.cred = cred;
```
4. Try the following command to see a list of properties on CDN Pro:
```Shell
node ./example.js
```

# Examples
You can study the example file [example.js](example.js) to learn the usage of of the library.

# Tools
There is currently 4 tools under the [tools](tools/) directory
## cdnPro.js
This tool helps you to view some CDN Pro resources, such as customer, service quota. Usage:
```bash
node tools/cdnPro.js function data
  function: the function name to call, one of:
     getCustomer
     getServiceQuota
     getSystemConfigs
  data: parameters for the function
Example: node tools/cdnPro.js getCustomer 123
```
## updateServiceQuotas.js
This tool can help administrators to easily add or remove one or more directives from the allowedCacheDirectives
field of a customer's service quota. Usage:
```bash
node tools/updateServiceQuotas.js customerId action data
  customerId: the customer ID
  action: one of addDirective, deleteDirective
  data: directives separated by comma
Example: node tools/updateServiceQuotas.js 1234 addDirective directive1,directive2
```
## updateSystemConfig.js
This tools helps our product team to update the directive lists of systemConfigs. Usage:
```bash
node tools/updateSystemConfigs.js action data
  action: one of addBaseDirectives, deleteBaseDirectives
                 addAdvancedDirectives, deleteAdvancedDirectives
                 addExperimentalDirectives, deleteExperimentalDirectives
  data: directives separated by comma
Example: node tools/updateSystemConfigs.js addExperimentalDirectives directive1,directive2
```
## batchUpdateProperties.js
This is a tool scans all the production property of a customer.
It finds all properties that meet a certain condition and create a new version based on the production version.
It then validates and deploys the vew versions to production.
 The actual condition and new version creation are defined in the taskConfig, which is a js file.
 To avoid mistakes, the tool is designed to run in 4 steps:

 1. (find) find a candidate list of currently deployed property and versions, save to a json DB file
 2. (check) load each of them to see if the condition is met
 3. (new) create new version, show diff to the current deployed version then validate
 4. (deploy) deploy the new versions in a batch. Right before the deployment, make sure the 
    deployed version is not changed

Usage: node batchUpdateProperties.js taskName find|check|new|deploy
    taskName: the name of the taskConfig file

Consult the [batchTask.template.js](tools/batchTask.template.js) for the taskConfig format.

# Dependencies
## node.js
Installation instructions: https://nodejs.org/en/download
## node package manager (npm)

# References
The API document: https://docs.cdnetworks.com/cdn/apidocs

# Troubleshooting
