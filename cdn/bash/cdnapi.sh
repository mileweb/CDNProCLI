#!/bin/bash
set -e

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
    echo "                  -p # prettify the json body (works on Mac or with nodejs)"
    echo "                  -v {verbose level 0-4} # >=3 has respose headers in stdout"
    echo "                  -k {private key file in PEM format}"
    echo "                  -c {certificate file in PEM format}"
    echo "                  -a {CA certificate file in PEM format}"
    echo "                  -l {date range for reports. 2d means the last 2 days}"
    echo "                  -m {date range of a month. e.g. 2020-01}"
    echo "                  -e {edge logic file}"
    echo "                  -b {json body}"
    echo "Note: You need to put your API username and key in a file named"
    echo "SECRET_api_credential.txt under the same directory."
    echo ""
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

appname=$0
uribase=/cdn
[[ ${appname} == *adminapi.sh ]] && uribase=/ngadmin

while readlink "${appname}" > /dev/null; do
  appname=`readlink "${appname}"`
done
appdir=$(dirname "${appname}")
method=$1
uri=$2

shift 2;

jsonfn=
privkeyfn=
certfn=
cacertfn=
edgelogicfn=
headers=
jsonpp=
jsonbody=
verblevel=2
verbopt="-vSs"

while getopts "j:dH:i:pk:c:a:e:b:v:l:m:" options; do
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
      if node -v > /dev/null; then
        jsonpp="|grep ^{\\\"|node \"${appdir}/../../common/json_pp.js\""
      elif json_pp -V > /dev/null; then
        jsonpp='|grep ^{\"|json_pp'
      fi
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
    l)
      enddate=$(LC_TIME="C" date -u "+%Y-%m-%dT%H:%M:%SZ")
      startdate=$(LC_TIME="C" date -v -${OPTARG} -u "+%Y-%m-%dT%H:%M:%SZ")
      daterange="startdate=${startdate}&enddate=${enddate}"
      echo "$uri" | grep "?" && daterange="&"$daterange || daterange="?"$daterange
      ;;
    m)
      month2d=(00 01 02 03 04 05 06 07 08 09 10 11 12)
      monthdays1=(0 31 28 31 30 31 30 31 31 30 31 30 31)
      year=${OPTARG%-*}
      month="${OPTARG#*-}"
      endday=${monthdays1[${month}]}
      month=${month2d[${month}]}
      rem=$(expr ${year} % 4 + 1)
      if [ "${month}" = 02 -a "${rem}" = 1 ]
      then endday=29
      fi
      startdate="${year}-${month}-01T00:00:00Z"
      enddate="${year}-${month}-${endday}T23:59:59Z"
      daterange="startdate=${startdate}&enddate=${enddate}"
      echo "$uri" | grep "?" && daterange="&"$daterange || daterange="?"$daterange
      ;;
    v)
      verblevel=${OPTARG}
      if [ ${OPTARG} -lt 2 ]; then verbopt="-sS"
      elif [ ${OPTARG} = 3 ]; then verbopt="-isS"
      elif [ ${OPTARG} = 4 ]; then verbopt="-visS"
      fi
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

API_SERVER=https://ngapi.quantil.com

#This file should contain the definition of two variables:
#USER='Your API username'
#API_KEY='You API key'
if [ -f ./SECRET_api_credential.txt ]; then
  source ./SECRET_api_credential.txt
else
  source $appdir/SECRET_api_credential.txt
fi

DATE=`LC_TIME="C" date -u "+%a, %d %b %Y %H:%M:%S GMT"`
#echo $DATE
# Generate authentication info
passw=$(echo -n "$DATE" | openssl dgst -sha1 -hmac "$API_KEY" -binary | base64)
#echo $passw

api_curl_cmd="curl ${verbopt} --url
 '${API_SERVER}${uribase}$uri$daterange' -X $method --compressed
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
          ${appdir}/build-property-body.sh "$jsonfn" "$edgelogicfn" > "$tempfn" ||
            ( rm "$tempfn"; exit 1 )
          jsonfn="$tempfn"
        fi
        ;;
      /certificates*)
        tempfn=$(mktemp ./cert.json.XXXXXX)
        certcmd="${appdir}/build-cert-body.sh '$jsonfn' "
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

[ $verblevel = 0 ]||echo $api_curl_cmd >& 2
#exit  #for testing
eval $api_curl_cmd $jsonpp
echo " "
[ -f "$tempfn" ] && rm "$tempfn"
exit 0;
