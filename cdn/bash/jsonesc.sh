#!/bin/sh

if [ $# -lt 1 ]; then
    echo "This script takes a text file, add escapes for newline, tab, double quote"
    echo "and back slash to generate a json string."
    echo "Usage:"
    echo "$0 [-u] {filename}"
    echo "-u means unescape. filename of - means stdin"
    exit 0;
fi

fn='-'
unesc=0
while [ $# -gt 0 ]; do
    if [ "$1" = "-u" ]; then
        unesc=1
    else
        fn="$1"
    fi
    shift
done


if [ ! -f "$fn" -a "$fn" != "-" ]; then
    echo "bad file: $fn"
    exit 1;
fi

if [ "$fn" = "-" ]; then
    fn=
fi

if [ $unesc = 0 ]; then
sed -e ':a' -e 'N' -e '$!ba' -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/   /\\t/g' -e 's/\n/\\n/g' $fn
else
sed -e 's/\\\\/__\\__/g' -e 's/\\"/"/g' -e 's/\\t/   /g' -e 's/\\n/\
/g' -e 's/__\\__/\\/g' $fn
fi

