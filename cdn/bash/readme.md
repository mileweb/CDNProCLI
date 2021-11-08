# Overview

This document describes the bash CLI toolset for managing the CDNetworks/QUANTIL's [CDN Pro service](https://www.cdnetworks.com/cdn360/).

The [cdnapi.sh](cdnapi.sh) file contains the main script. There is a symbolic link [adminapi.sh](adminapi.sh) which can be used by resellers to call the admin API to manage various accounts for their customers.

# Instructions
1. Clone the latest files using the following command:
```
git clone https://github.com/mileweb/qtlcli.git
```
2. Create a file  named `SECRET_api_credential.txt` under the project directory. Open a text editor and put the following content into the file:
```
USER='Your API username'
API_KEY='You secret API key'
```
3. For the API calls (POST, PATCH, PUT) that need to send data to the server, create the request body using one of the following methods:
    * Prepare the request body in a JSON file, and pass the file name after the ```-j``` switch, or
    * Use the ```-b``` switch and put the body content after it.
4. For the property creation and update API calls, use the ```-e``` switch to pass the [Edge Logic](https://docs.quantil.com/cdn/docs/edge-logic/intro) file to the main script. The script looks for ```"serverScript" : _EDGE_LOGIC_``` in the JSON file and replaces ```_EDGE_LOGIC_``` with the escaped Edge Logic code.
5. For the certificate creation and update API calls, use the ```-k```, ```-c```, ```-a``` switches to pass the private key, certificate, and CA certificate files respectively to the main script. The script looks for ```"privateKey": _PRIVATE_KEY_``` , ```"certificate": _CERTIFICATE_``` , and ```"chainCert": _CA_CERTIFICATE_``` in the JSON file and replaces them with the corresponding escaped certificate files.
6. This tool invokes cURL under the hood and it by default displays the complete cURL command that you can refer to to create your own code to call the API.

The [json-template](../json-templates) folder within this repository contains some sample JSON template files that you can use for creating and updating a property or certificate.

# Examples

### query all certificates
```bash
./cdnapi.sh GET /certificates -p
```
### create a certificate
```bash
./cdnapi.sh POST /certificates -p -j ../json-templates/cert.json -k privkey.pem -c cert.pem -a chain.pem
```
### query all properties
```bash
./cdnapi.sh GET /properties -p
```
### create a property
```bash
./cdnapi.sh POST /properties -p -j ../json-templates/property.json -e edgescript.txt
```
### query the bandwidth report of the last 24 hours
```bash
./cdnapi.sh POST '/report/bandwidth?type=fiveminutes' -p -l 24H
```
### perform a purge of 2 files
```bash
./cdnapi.sh POST /purges -p -b '{
"fileUrls":["https://www.quantil.com/abc.jpg","http://www.quantil.com/def.css"],
"action":"invalidate",
"target":"production"}'
```
### deploy a property and a certificate to staging
```bash
./cdnapi.sh POST /deploymentTasks -p -b '{
"name":"deploy property 1234abcd v3 and cert def1234 v4 to staging",
"target":"staging",
"actions":[
{"action":"deploy_property", "certificateId":"1234abcd","version":"3"},
{"action":"deploy_cert", "certificateId":"def1234","version":"4"}
]}'
```
### (Reseller-Only) Create a new API account for customer 123
```bash
./adminapi.sh POST /apiAccounts -i 123 -p -b '{
"responsiblePerson": "John Doe",
"apiName": "jdoe-api",
"emailAddress": "john.doe@company.com",
"products": ["CDN", "ECP"],
"type": "read-only"
}'
```
### (Reseller-Only) Reset the password of API account 4 of customer 123
```bash
./adminapi.sh PATCH /apiAccounts/4 -i 123 -p -b '{"apiKey": "reset";}'
```

# Dependencies
Effort has been made to minimize any third-party package requirements. The only dependency is to have ```openssl```, ```sed```, and ```grep```available in your bash environment.

# References
The API document: https://docs.quantil.com/cdn/apidocs

# Troubleshooting

### Using control characters in the JSON file
Make sure the JSON body does not contain any unprintable control characters. Otherwise, the following error will appear from the API server:
```
Illegal unquoted character ((CTRL-CHAR, code 6))
```
which means you have a special character 0x06 in your JSON template or your Edge Logic file.
