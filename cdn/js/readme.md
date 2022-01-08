# Overview

This document describes the JavaScript library for managing the CDNetworks/QUANTIL's [CDN Pro service](https://www.cdnetworks.com/cdn360/).

The [qtl-api-tools.js](qtl-api-tools.js) file contains the help functions to generate the dynamic password, facilitate the HTTPS request and parse the response.

# Instructions
1. Clone the latest files using the following command:
```
git clone https://github.com/mileweb/qtlcli.git
```
2. Create a file  named `SECRET_api_credential.json` under the project directory. Open a text editor and put the following content into the file:
```
{
  "ngServer" : { 
    "host" : "ngapi.quantil.com",
    "user" : "{API USER NAME}",
    "secretKey" : "{SECRET API KEY}"
  }
}
```
3. TO BE FINISHED

# Examples


# Dependencies

# References
The API document: https://docs.quantil.com/cdn/apidocs

# Troubleshooting
