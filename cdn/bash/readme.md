Here is the bash CLI toolset for managing CDN service.
[cdnapi.sh](cdnapi.sh) is the main script.

Examples:
```bash
#create a certificate
./cdnapi.sh POST /certificates -p -j ../json-template/cert.json -k privkey.pem -c cert.pem -a chain.pem
#create a property
./cdnapi.sh POST /properties -p -j ../json-template/property.json -e edgescript.txt
```
