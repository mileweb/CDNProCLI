const {execSync} = require('child_process');

var stdin = process.stdin,
    stdout = process.stdout,
    inputChunks = [];

//var propertyId = process.argv[2];
stdin.resume();
stdin.setEncoding('utf8');

stdin.on('data', function (chunk) {
    inputChunks.push(chunk);
});

stdin.on('end', function () {
    var inputJSON = inputChunks.join('');
    var rsp = JSON.parse(inputJSON);

    console.log(JSON.stringify(rsp,null,2));
});
