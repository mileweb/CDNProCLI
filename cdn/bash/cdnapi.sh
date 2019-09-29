#!/bin/bash
set -e

API_SERVER=https://ngapi.quantil.com

#This file should contain the definition of two variables:
#USER='Your API username'
#API_KEY='You API key'
source ./SECRET_api_credential.txt

DATE=`date -u "+%a, %d %b %Y %H:%M:%S %Z"`
#echo $DATE
# Generate authentication info
passw=$(echo -n "$DATE" | openssl dgst -sha1 -hmac "$API_KEY" -binary | base64)
#echo $passw
if [ $# -lt 2 ]; then
    echo "Usage:"
    echo "$0 {method} {uri} [options]"
    echo ""
    echo "{method} can be GET, POST, PUT, PATCH or DELETE"
    echo "{url} can be /properties, /certificates etc"
    echo "[options] can be: -j {json filename for request body}"
    echo "                  -d # add the x-debug header"
    echo "                  -i {child customer ID to impersonate}"
    echo "                  -H 'headerName: headerValue' # add additional request header"
    echo "                  -p # prettify the json body (only works on Mac for now)"
    echo "Some common tasks:"
    echo "$0 GET /properties                               #query property list"
    echo "$0 GET /properties/{id}                          #query one property"
    echo "$0 GET /properties/{id}/versions                 #query versions list"
    echo "$0 GET /properties/{id}/versions/{ver}           #query one property version"
    echo "$0 POST /properties -j {body}.json -e {edgelogic}.el     #create a new property"
    echo "$0 POST /properties/{id}/versions -j {body}.json -e {edgelogic}.el"
    echo "                                                 #create a new property version"
    echo "$0 PATCH /properties/{id}/versions/{version} -j {body}.json -e {edgelogic}.el"
    echo "                                                 #update a version"
    echo "$0 PATCH /properties/{id} -j {body}.json         #update a property"
    echo "$0 DELETE /properties/{id}                       #delete a property"
    echo "$0 GET /certificates                             #query certificate list"
    echo "$0 GET /certificates/{id}                        #query one certificate"
    echo "$0 GET /certificates/{id}/csr                    #download the CSR"
    echo "$0 GET /certificates/{id}/versions/{ver}         #query one certificate version"
    echo "$0 POST /certificates -j {body}.json [-k key.pem] [-c cert.pem] [-a cacert.pem]"
    echo "                                                 #create a new certificate"
    echo "$0 PATCH /certificates/{id} -j {body}.json [-k key.pem] [-c cert.pem] [-a cacert.pem]"
    echo "                                                 #update a certificate"
    echo "$0 DELETE /certificates/{id}                     #delete a certificate"
    echo "$0 POST /validations -j {body}.json              #create a validation task"
    echo "$0 GET /validations                              #query validation task list"
    echo "$0 GET /validations/{id}                         #query one validation task"
    echo "$0 POST /deploymentTasks -j {body}.json          #create a deployment task"
    echo "dig staging.qtlgslb.com                          #query the staging server IPs"
    echo "$0 GET /deploymentTasks                          #query deployment task list"
    echo "$0 GET /deploymentTasks/{id}                     #query a deployment task"
    echo "$0 POST /cnames -j {body}.json                   #create a CNAME"
    echo "$0 GET /cnames                                   #query CNAME list"
    echo "$0 GET /cnames/{id}                              #query a CNAME"
    echo "$0 PUT /cnames/{id}                              #updae a CNAME"
    echo "$0 DELETE /cnames/{id}                           #delete a CNAME"
    exit 0;
fi

method=$1
uri=$2
uribase=/cdnapi
[ ${uri:0:7} = "/report" ] && uribase=

shift 2;

jsonfn=
privkeyfn=
certfn=
cacertfn=
edgelogicfn=
headers=
jsonpp=
jsonbody=

while getopts "j:dH:i:pk:c:a:e:b:" options; do
  case "${options}" in                          
    j)
      jsonfn=${OPTARG}
      ;;
    d)
      headers+=" -H 'x-debug: true'"
      ;;
    i)
      headers+=" -H 'on-behalf-of: ${OPTARG}'"
      ;;
    H)
      headers+=" -H '${OPTARG}'"
      ;;
    p)
      jsonpp='|grep ^{\"|json_pp'
      ;;
    k)
      privkeyfn="${OPTARG}"
      ;;
    c)
      certfn="${OPTARG}"
      ;;
    a)
      cacertfn="${OPTARG}"
      ;;
    e)
      edgelogicfn="${OPTARG}"
      ;;
    b)
      jsonbody="${OPTARG}"
      ;;
    :)
      echo "Error: -${OPTARG} requires an argument."
      exit 1
      ;;
    *)
      echo "Error: unknown input error."
      exit 1
      ;;
  esac
done

api_curl_cmd="curl -vsS --url
 '${API_SERVER}${uribase}$uri' -X $method --compressed
            -u '$USER:$passw'
			-H 'Date: $DATE'
			-H 'Content-Type: application/json'
			-H 'Accept: application/json'
			$headers
"
tempfn=
if [ "$method" = "POST" -o "$method" = "PUT" -o "$method" = "PATCH" ]; then
  if [ -f "$jsonfn" ]; then
    case "$uri" in
      /properties*)
        if [ -f "$edgelogicfn" ]; then
          tempfn=$(mktemp ./property.json.XXXXXX)
          ./build-property-body.sh "$jsonfn" "$edgelogicfn" > "$tempfn" ||
            ( rm "$tempfn"; exit 1 )
          jsonfn="$tempfn"
        fi
        ;;
      /certificates*)
        tempfn=$(mktemp ./cert.json.XXXXXX)
        certcmd="./build-cert-body.sh '$jsonfn' "
        [ -f "$privkeyfn" ] && certcmd+="-k '$privkeyfn' -d '$DATE' "
        [ -f "$certfn" ] && certcmd+="-c '$certfn' "
        [ -f "$cacertfn" ] && certcmd+="-a '$cacertfn'"
        eval $certcmd > "$tempfn" ||
          ( rm "$tempfn"; exit 1 )
        jsonfn="$tempfn"
        ;;
    esac
    api_curl_cmd+=" -d @'$jsonfn'"
  elif [ "$jsonbody" ]; then
    api_curl_cmd+=" -d '$jsonbody'"
  else
    echo "Method \"$method\" requires a valid json file to be specified after -j"
    echo "                   or a json body specified after -b"
    exit 1
  fi
fi

echo $api_curl_cmd
#exit  #for testing
time eval $api_curl_cmd $jsonpp
echo " "
[ -f "$tempfn" ] && rm "$tempfn"
exit 0;
