Here is the bash CLI toolset for managing CDN service.
[cdnapi.sh](cdnapi.sh) is the main script.

# Instructions
0. Clone this repository, of course.
1. You need to create a file SECRET_api_credential.txt under this directory. the content should be:
```
USER='Your API username'
API_KEY='You secret API key'
```
2. For the API calls that need to send data to the server, you need to prepare the request body in a json file, and pass the file name after the ```-j``` switch.
3. For the property creation and update API calls, you can use the ```-e``` switch to pass the [Edge Logic](https://docs.google.com/document/d/119Lpq__vF8di1y2-A8ANeUsmyiw-T8ppp5J745oCrWk/edit?usp=sharing) file to the main script. The script will look for ```"serverScript" : _EDGE_LOGIC_``` in the json file and replace ```_EDGE_LOGIC_``` with the escaped Edge Logic code.
4. For the certificate creation and update API calls, you can use the ```-k```, ```-c```, ```-a``` switches to pass the private key, certificate and CA certificate files, respectively, to the main script. The script will look for ```"privateKey": _PRIVATE_KEY_``` and ```"certificate": _CERTIFICATE_``` and ```"chainCert": _CA_CERTIFICATE_``` in the json file and replace them with the corresponding escaped certificate files.
5. [../json-templates](../json-templates) contains some sample json template files that can be used for creating and updating property or certificate.

# Examples
```bash
#query all certificates
./cdnapi.sh GET /certificates -p
#create a certificate
./cdnapi.sh POST /certificates -p -j ../json-templates/cert.json -k privkey.pem -c cert.pem -a chain.pem
#query all properties
./cdnapi.sh GET /properties -p
#create a property
./cdnapi.sh POST /properties -p -j ../json-templates/property.json -e edgescript.txt
```
