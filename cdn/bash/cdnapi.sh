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
    echo "$0 POST /properties -j {body}.json               #create a new property"
    echo "$0 POST /properties/{id}/versions -j {body}.json #create a new version"
    echo "$0 PATCH /properties/{id}/versions/{version} -j {body}.json   #update a version"
    echo "$0 PATCH /properties/{id} -j {body}.json         #update a property"
    echo "$0 DELETE /properties/{id}                       #delete a property"
    echo "$0 GET /certificates                             #query certificate list"
    echo "$0 GET /certificates/{id}                        #query one certificate"
    echo "$0 GET /certificates/{id}/csr                    #download the CSR"
    echo "$0 GET /certificates/{id}/versions/{ver}         #query one certificate version"
    echo "$0 POST /certificates -j {body}.json             #create a new certificate"
    echo "$0 PATCH /certificates/{id} -j {body}.json       #update a certificate"
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

shift 2;

jsonfn=
headers=
jsonpp=

while getopts "j:dH:i:p" options; do
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
 '${API_SERVER}/cdnapi$uri' -X $method --compressed
            -u '$USER:$passw'
			-H 'Date: $DATE'
			-H 'Content-Type: application/json'
			-H 'Accept: application/json'
			$headers
		"
if [ "$method" = "POST" -o "$method" = "PUT" -o "$method" = "PATCH" ]; then
  if [ -f "$jsonfn" ]; then
    api_curl_cmd+=" -d @$jsonfn"
  else
    echo "Method \"$method\" requires a valid json file to be specified after -j"
    exit 1
  fi
fi

echo $api_curl_cmd
time eval $api_curl_cmd $jsonpp
echo " "

exit 0;
