# Overview

This document describes the JavaScript library for managing the CDNetworks/QUANTIL's [CDN Pro service](https://www.cdnetworks.com/cdn360/).

The [qtl-api-tools.js](qtl-api-tools.js) file contains the help functions to generate the dynamic password, facilitate the HTTPS request and parse the response.

# Instructions
1. Clone the latest files using the following command:
```
git clone https://github.com/mileweb/qtlcli.git
```
2. go to the js directory and install the 2 required packages:
```
cd qtlcli/cdn/js
npm install xml2js
```
3. Create a file to include the API credentials, for exmaple `SECRET_credential.js`. Open a text editor and put the following content into the file:
```Javascript
const cred = {
  "ngServer" : { 
    "host" : "ngapi.quantil.com",
    "user" : "{API USER NAME}",
    "secretKey" : "{SECRET API KEY}"
  }
}
exports.cred = cred;
```
4. Try the following command to see a list of properties on CDN Pro:
```Shell
node ./cdnapi.js
```

# Examples
You can study the example file [cdnapi.js](cdnapi.js) to learn the usage of of the library.

# Dependencies
## node.js
Installation instructions: https://nodejs.dev/learn/how-to-install-nodejs
## node package manager (npm)

# References
The API document: https://docs.quantil.com/cdn/apidocs

# Troubleshooting
