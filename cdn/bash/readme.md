# Overview

The following describes the bash CLI toolset for managing the CDN service.

The [cdnapi.sh](cdnapi.sh) file contains the main script.

# Instructions
1. Clone the latest files using the following command:
```
git clone https://github.com/mileweb/qtlcli.git
```
2. Create a file  named `SECRET_api_credential.txt` under this directory. Open a text editor and edit the file with the following:
```
USER='Your API username'
API_KEY='You secret API key'
```
3. For the API calls that need to send data to the server, create the request body using one of the following methods:
    * Prepare the request body in a JSON file, and pass the file name after the ```-j``` switch, or
    * Use the ```-b``` switch and put the body content after it.
4. For the property creation and update API calls, use the ```-e``` switch to pass the [Edge Logic](https://docs.google.com/document/d/119Lpq__vF8di1y2-A8ANeUsmyiw-T8ppp5J745oCrWk/edit?usp=sharing) file to the main script. The script looks for ```"serverScript" : _EDGE_LOGIC_``` in the JSON file and replaces ```_EDGE_LOGIC_``` with the escaped Edge Logic code.
5. For the certificate creation and update API calls, use the ```-k```, ```-c```, ```-a``` switches to pass the private key, certificate, and CA certificate files respectively to the main script. The script looks for ```"privateKey": _PRIVATE_KEY_``` , ```"certificate": _CERTIFICATE_``` , and ```"chainCert": _CA_CERTIFICATE_``` in the JSON file and replaces them with the corresponding escaped certificate files.

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


# Dependencies
Effort has been made to minimize any third-party package requirements. The only dependency is to have ```openssl```, ```sed```, and ```grep```available in your bash environment.

# Troubleshooting

### Using control characters in the JSON file
Make sure the JSON body does not contain any unprintable control characters. Otherwise, the following error will appear from the API server:
```
Illegal unquoted character ((CTRL-CHAR, code 6))
```
which means you have a special character 0x06 in your JSON template or your Edge Logic file.
