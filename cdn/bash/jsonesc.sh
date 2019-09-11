#!/bin/sh

if [ $# -lt 1 ]; then
    echo "This script takes a text file, add escapes for newline, tab, double quote"
    echo "and back slash to generate a json string."
    echo "Usage:"
    echo "$0 {filename}"
    exit 0;
fi

sed -e ':a' -e 'N' -e '$!ba' -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/   /\\t/g' -e 's/\n/\\n/g' $1
