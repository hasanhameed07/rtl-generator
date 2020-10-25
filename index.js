/**
 * Module dependencies.
 */
const readline = require('linebyline'),
fs = require('fs'),
beautify = require('beautify');

/**
 * Constants.
 */
const PX_MATCH_REGEX = /(-)?\d{0,4}(px|rem|em|%|auto|0)/g;
const VALUE_MATCH_REGEX = /:((?!;).)*/g;
const EOL = '\r\n';
const TAB = '  ';
const RTL_PARENT_CLASS = '.rtl ';

/*
 * By default it appends the converted css to the input files provided
 * To use a different file to write conversion; provide outputFile option
 * 
 * options:
 * inputFiles: array[string] (required)
 * outputFile: string (optional)
 * rtlParentClass: string
 * returnOutputOnly: boolean (for debugging purpose)
 */
module.exports = function (options) {
  return new Promise(async (resolve, reject) => {
    if (!options || !options.inputFiles) {
      reject('No input file provided for conversion.');
      return;
    }
    if (!options.rtlParentClass) {
      options.rtlParentClass = RTL_PARENT_CLASS;
    }
    const results = [];
    let i = 0;
    for (const file of options.inputFiles) {
      generateFormatedFile(file);
      results[i] = await convert({...options, inputFile: file});
      removeFormatedFile(file);
      i++;
    }
    resolve(results);
  });
};

function generateFormatedFile(file) {
  const fileData = fs.readFileSync(file, {encoding:'utf8', flag:'r'}); 
  const formated = beautify(fileData, { format: 'css' });
  fs.writeFileSync(file.replace('.css', '-temp.css'), formated);
}

function removeFormatedFile(file) {
  fs.unlinkSync(file.replace('.css', '-temp.css'));
}

function convert(options) {
  return new Promise((resolve, reject) => {
    try {
      if (!options.inputFile) {
        reject('No input file provided for conversion.');
        return;
      }
      const inputFile = options.inputFile.replace('.css', '-temp.css');
      let originalFile = '';
      let selectorCache = '';
      let areChangesMade = false;
      let selectorsCountInsideMediaQuery = 0;
      let skipNextLineFlip = false;
      let areChangesMadeInsideMediaQuery = false;
      let insideMediaQuery = false;

      let output = `${EOL}/* css from rtl-generator - [https://github.com/hasanhameed07/rtl-generator] */${EOL}`;
      let prevLines = '';

      const rl = readline(options.inputFile);


      rl.on('line', (line, lineCount, byteCount) => {
        // do something with the line of text
        originalFile += line + EOL;

        if (skipNextLineFlip) {
          skipNextLineFlip = false;
          return;
        }

        if (!line.trim() || line.match(/\/\*(.*)\*\//g)) {
          // remove empty line or single line comment
          if (line.trim() === '/*skip-rtl-conversion-below-line*/') {
            skipNextLineFlip = true;
          }
          return;
        }

        prevLines += line.trim()
          .replace(/( )*\{( )*/g, '{').replace(/( )*\}( )*/g, '}');  // for internal calculation

        // opening
        if (line.match(/\{/g)) {
          if (line.match(/@media/g)) {
            insideMediaQuery = true;
            output += line + EOL;
          }
          else {
            selectorCache += RTL_PARENT_CLASS;
            const prevLinesMinusLastOpenBracket = prevLines.slice(0, -1);
            const lastBrackClose = prevLines.lastIndexOf('}');
            const lastBrackStart = prevLinesMinusLastOpenBracket.lastIndexOf('{');
            const fromLastBracketClosed = prevLines.slice(lastBrackClose + 1);
            if (fromLastBracketClosed.match(/@media/g)) {
              selectorCache += lastBrackStart > -1 ? prevLines.slice(lastBrackStart + 1) : line + EOL;
            }
            else {
              selectorCache += lastBrackClose > -1 ? prevLines.slice(lastBrackClose + 1) : line + EOL;
            }
            if (insideMediaQuery) {
              selectorsCountInsideMediaQuery++;
            }
          }
          return;
        }

        // properties
        ({ selectorCache, areChangesMade } = textAlignLeft(line, selectorCache, areChangesMade));
        ({ selectorCache, areChangesMade } = textAlignRight(line, selectorCache, areChangesMade));
        if (!areChangesMade) { ({ selectorCache, areChangesMade } = floatLeftToRight(line, selectorCache, areChangesMade)); }
        if (!areChangesMade) { ({ selectorCache, areChangesMade } = floatRightToLeft(line, selectorCache, areChangesMade)); }
        if (!areChangesMade) { ({ selectorCache, areChangesMade } = marginOfFour(line, selectorCache, areChangesMade)); }
        if (!areChangesMade) { ({ selectorCache, areChangesMade } = paddingOfFour(line, selectorCache, areChangesMade)); }

        if (areChangesMade && insideMediaQuery) {
          areChangesMadeInsideMediaQuery = true;
        }

        // selector ending
        if (line.match(/\}/g)) {
          // if end of media query
          const mediaQueryEndReached = !!(insideMediaQuery && (prevLines.slice(-2) === '}}' || prevLines.slice(-3) === '){}'));

          // check for replacements in the whole block
          if (!mediaQueryEndReached) {
            const lastBrackOpen = prevLines.lastIndexOf('{');
            [
              paddingLeftRightInBlock,
              marginLeftRightInBlock,
              positionLeftRightInBlock,
              borderLeftRightInBlock,
              borderColorLeftRightInBlock,
              borderWidthLeftRightInBlock,
              borderStyleLeftRightInBlock
            ].forEach((method) => {
              ({ selectorCache, areChangesMade } = method(prevLines.slice(lastBrackOpen + 1), selectorCache, areChangesMade));
              if (areChangesMade && insideMediaQuery) {
                areChangesMadeInsideMediaQuery = true;
              }
            });
          }


          if (!areChangesMade) {
            selectorCache = '';
          } else if (areChangesMade && selectorCache) {
            // end of selector
            selectorCache += `}${EOL}`;
            output += selectorCache;
            selectorCache = '';
            areChangesMade = false;
          }

          if (mediaQueryEndReached || (insideMediaQuery && !selectorsCountInsideMediaQuery)) {
            output += `}${EOL}`;
            insideMediaQuery = false;
            areChangesMadeInsideMediaQuery = false;
          }
        }
      })
        .on('close', (e) => {
          const data = beautify(output, { format: 'css' });
          if (options.returnOutputOnly) {
            resolve(data);
            return;
          }
          else if (!options.outputFile) {
            fs.appendFileSync(inputFile, data);
          }
          else {
            fs.writeFileSync(options.outputFile, data);
          }
          resolve(true);
        })
        .on('error', (e) => {
          // something went wrong
          reject(e);
        });
    } catch (e) {
      reject(e);
    }
  });
}



function textAlignLeft(line, selectorCache, areChangesMade) {
  const matched = line.match(/text-align:( )*left/g);
  if (matched) {
    selectorCache += TAB + line.replace(/text-align:( )*left(\!important)?/g, 'text-align: right $2') + EOL;
    areChangesMade = true;
  }
  return { selectorCache, areChangesMade };
}

function textAlignRight(line, selectorCache, areChangesMade) {
  const matched = line.match(/text-align:( )*right/g);
  if (matched) {
    selectorCache += TAB + line.replace(/text-align:( )*right(\!important)?/g, 'text-align: left $2') + EOL;
    areChangesMade = true;
  }
  return { selectorCache, areChangesMade };
}

function floatLeftToRight(line, selectorCache, areChangesMade) {
  const matched = line.match(/float:( )*left/g);
  if (matched) {
    selectorCache += TAB + line.replace(/float:( )*left(\!important)?/g, 'float: right $2') + EOL;
    areChangesMade = true;
  }
  return { selectorCache, areChangesMade };
}
function floatRightToLeft(line, selectorCache, areChangesMade) {
  const matched = line.match(/float:( )*right/g);
  if (matched) {
    selectorCache += TAB + line.replace(/float:( )*right(\!important)?/g, 'float: left $2') + EOL;
    areChangesMade = true;
  }
  return { selectorCache, areChangesMade };
}


function marginOfFour(line, selectorCache, areChangesMade) {
  const matched = line.match(/margin: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  if (matched) {
    const pixels = line.match(PX_MATCH_REGEX);
    if (pixels.length === 4) {
      selectorCache += `${TAB}margin: ${pixels[0]} ${pixels[3]} ${pixels[1]} ${pixels[2]};${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function paddingOfFour(line, selectorCache, areChangesMade) {
  const matched = line.match(/padding: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  if (matched) {
    const pixels = line.match(PX_MATCH_REGEX);
    if (pixels.length === 4) {
      selectorCache += `${TAB}padding: ${pixels[0]} ${pixels[3]} ${pixels[1]} ${pixels[2]};${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function marginLeftRightInBlock(line, selectorCache, areChangesMade) {
  const matchedLeft = line.match(/margin-left: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  const matchedRight = line.match(/margin-right: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  if (matchedLeft) {
    const pixelsLeft = matchedLeft[0].match(PX_MATCH_REGEX);
    if (pixelsLeft) {
      selectorCache += `${TAB}margin-right:${pixelsLeft[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}margin-left: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(PX_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}margin-left:${pixelsRight[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}margin-right: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function paddingLeftRightInBlock(line, selectorCache, areChangesMade) {
  const matchedLeft = line.match(/padding-left: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  const matchedRight = line.match(/padding-right: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  if (matchedLeft) {
    const pixelsLeft = matchedLeft[0].match(PX_MATCH_REGEX);
    if (pixelsLeft) {
      selectorCache += `${TAB}padding-right:${pixelsLeft[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}padding-left: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(PX_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}padding-left:${pixelsRight[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}padding-right: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function positionLeftRightInBlock(line, selectorCache, areChangesMade) {
  const matchedLeft = line.match(/((^)|(;))left: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  const matchedRight = line.match(/((^)|(;))right: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  if (matchedLeft) {
    const pixelsLeft = matchedLeft[0].match(PX_MATCH_REGEX);
    if (pixelsLeft) {
      selectorCache += `${TAB}right:${pixelsLeft[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}left: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(PX_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}left:${pixelsRight[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}right: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function borderLeftRightInBlock(line, selectorCache, areChangesMade) {
  const matchedLeft = line.match(/(border-right:((?!;).)*;)/g);
  const matchedRight = line.match(/(border-right:((?!;).)*;)/g);
  if (matchedLeft) {
    const pixelsLeft = matchedLeft[0].match(VALUE_MATCH_REGEX);
    if (pixelsLeft) {
      selectorCache += `${TAB}border-right${pixelsLeft[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}border-left: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(VALUE_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}border-left${pixelsRight[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}border-right: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function borderColorLeftRightInBlock(line, selectorCache, areChangesMade) {
  const matchedLeft = line.match(/(border-left-color:((?!;).)*;)/g);
  const matchedRight = line.match(/(border-right-color:((?!;).)*;)/g);
  if (matchedLeft) {
    const pixelsLeft = matchedLeft[0].match(VALUE_MATCH_REGEX);
    if (pixelsLeft) {
      selectorCache += `${TAB}border-right-color${pixelsLeft[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}border-left-color: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(VALUE_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}border-left-color${pixelsRight[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}border-right-color: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function borderStyleLeftRightInBlock(line, selectorCache, areChangesMade) {
  const matchedLeft = line.match(/(border-left-style:((?!;).)*;)/g);
  const matchedRight = line.match(/(border-right-style:((?!;).)*;)/g);
  if (matchedLeft) {
    const pixelsLeft = matchedLeft[0].match(VALUE_MATCH_REGEX);
    if (pixelsLeft) {
      selectorCache += `${TAB}border-right-style${pixelsLeft[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}border-left-style: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(VALUE_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}border-left-style${pixelsRight[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}border-right-style: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}

function borderWidthLeftRightInBlock(line, selectorCache, areChangesMade) {
  const matchedLeft = line.match(/border-left-width: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  const matchedRight = line.match(/border-right-width: (-)?\d{0,4}(px|rem|em|%|auto|0)/g);
  if (matchedLeft) {
    const pixelsLeft = matchedLeft[0].match(PX_MATCH_REGEX);
    if (pixelsLeft) {
      selectorCache += `${TAB}border-right-width:${pixelsLeft[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}border-left-width: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(PX_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}border-left-width:${pixelsRight[0]};${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}border-right-width: unset;${EOL}`;
      areChangesMade = true;
    }
  }
  return { selectorCache, areChangesMade };
}
