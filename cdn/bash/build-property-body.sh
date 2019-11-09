#!/bin/bash
set -e

if [ $# -lt 1 ]; then
    echo "This script normally takes 2 text files. The first one is a json that describes"
    echo "a property, or property version. The content of the second file should be the"
    echo "edge logic code. This script will perform json string escaping for the second"    
    echo "file and replace the edgeLogic field value in the first file. Output will be on"
    echo "stdout. The json file has to terminate with a newline, and contains"
    echo "\"serverScript\": _EDGE_LOGIC_"
    echo "          OR"
    echo "\"edgeLogic\": _EDGE_LOGIC_"
    echo "on a dedicated line."
    echo "Usage:"
    echo "$0 {property}.json {edgelogic}.el"
    exit 0;
fi

appname=$0
while readlink "${appname}" > /dev/null; do
  appname=`readlink "${appname}"`
done
appdir=$(dirname "${appname}")

jsonfn=$1
elfn=$2

while IFS= read -r line
do
  if echo "$line" | grep -q '"\(edgeLogic\|serverScript\)" *: *_EDGE_LOGIC_'; then
      [ -f "$elfn" ] || ( >&2 echo "$jsonfn contains _EDGE_LOGIC_ but missing edge script file!"; exit 1; )
      esc1=$($appdir/jsonesc.sh $elfn);
      esc2=${esc1//\\/\\\\}   #some additional substitutions for sed
      esc3=${esc2//\//\\/}
      echo "$line" |sed "s/_EDGE_LOGIC_/\"$esc3\"/"
#      printf "%s\n" "\"serverScript\":\"$($appdir/jsonesc.sh $elfn)\""
  else
      echo "$line"
  fi
done < "$jsonfn"
