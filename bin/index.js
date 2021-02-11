#!/usr/bin/env node

const yargs = require('yargs');
const rtlGenerator = require('../index');

const options = yargs
 .usage("Usage: -f <[file names]> \n -output-o <boolean value for output only>")
 .option("f",{ alias: "Files", describe: "Files to convert", type: "array", demandOption: true })
 .option("output-o", { alias: "output", describe: "pass true to output all files", type: "boolean", demandOption: false })
 .argv;

let result;
async function rtl(){
    try{  
         result = await rtlGenerator({
            returnOutputOnly: options["output-only"],
            inputFiles: options['files'],
        })
        console.log(result);
    }
    catch(err){
        console.log('Error', err);
    }
}
rtl();