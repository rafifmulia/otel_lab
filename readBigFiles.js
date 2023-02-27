const fs = require('fs');
const es = require('event-stream');

const inputFilePath = './logs/callng.log.2';
const outputFilePath = 'callng.log.2.status';

const filteredLines = [];

// Create a read stream to read from the input file
const readStream = fs.createReadStream(inputFilePath, 'utf8');

// Pipe the read stream through event-stream to process it line by line
readStream
  .pipe(es.split())
  .pipe(es.through(function (line) {
    // If the line contains the string "Doe", add it to the filteredLines array
    if (line.includes('status')) {
          filteredLines.push(line);
          console.log(line.includes('status'));
        }
  }, function () {
    // This function is called when the input stream ends
    // Create a write stream to write the filtered output to the output file
    const writeStream = fs.createWriteStream(outputFilePath, 'utf8');

    // Write the filtered lines to the output file, separated by a newline character
    writeStream.write(filteredLines.join('\n'));

    // End the write stream
    writeStream.end();

    console.log(`Filtered lines written to ${outputFilePath}`);
  }));
