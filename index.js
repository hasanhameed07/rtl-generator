/**
 * Module dependencies.
 */
const readline = require('linebyline'),
fs = require('fs'),
path = require('path'),
glob = require('glob'),
beautify = require('beautify');

/**
 * Constants.
 */
const PX_MATCH_REGEX = /(-)?[.0-9]{0,4}(px|rem|em|%|auto|0)/g;
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
 * folderPath: string (optional; if provided, all the css and scss within the folder path will be converted) 
 * outputFile: string (optional)
 * rtlParentClass: string
 * returnOutputOnly: boolean (for debugging purpose)
 */
module.exports = function (options) {
  return new Promise(async (resolve, reject) => {
    if (!options || (!options.inputFiles && !options.folderPath)) {
      reject('No input file provided for conversion.');
      return;
    }
    if (!options.rtlParentClass) {
      options.rtlParentClass = RTL_PARENT_CLASS;
    }
    if (options.folderPath) {
      options.inputFiles = await getCssInFolder(options.folderPath);
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

function getCssInFolder(folder) {
  return new Promise(async (resolve, reject) => {
    glob(folder + '/**/*.css', {}, (err, cssFIles)=>{
      glob(folder + '/**/*.scss', {}, (err, scssFiles)=>{
        resolve([...cssFIles, ...scssFiles]);
      });
    });
  });
}

function generateFormatedFile(file) {
  const fileData = fs.readFileSync(file, {encoding:'utf8', flag:'r'}); 
  const formated = beautify(fileData, { format: 'css' });
  fs.writeFileSync(file.replace('.scss', '-temp.scss').replace('.css', '-temp.css'), formated);
}

function removeFormatedFile(file) {
  fs.unlinkSync(file.replace('.scss', '-temp.scss').replace('.css', '-temp.css'));
}

function convert(options) {
  return new Promise((resolve, reject) => {
    try {
      if (!options.inputFile) {
        reject('No input file provided for conversion.');
        return;
      }
      const inputFile = options.inputFile.replace('.scss', '-temp.scss').replace('.css', '-temp.css')
      let originalFile = options.inputFile;
      let selectorCache = '';
      let areChangesMade = false;
      let selectorsCountInsideMediaQuery = 0;
      let skipNextLineFlip = false;
      let areChangesMadeInsideMediaQuery = false;
      let insideMediaQuery = false;
      let commentOpened = false;
      let output = '';
      const outputStart = `${EOL}${EOL}/* start-css-from rtl-generator - [https://github.com/hasanhameed07/rtl-generator] */${EOL}
/* original-file: ${path.basename(originalFile)} */${EOL}`;
      const outputEnd = `/* end-of-css-from rtl-generator original-file: ${path.basename(originalFile)} */${EOL}`;
      let prevLines = '';

      const rl = readline(inputFile);


      rl.on('line', (line, lineCount, byteCount) => {
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
        // ignore multi-line comment starting
        else if (line.match(/\/\*/g) && !line.match(/\*\//g)) {
          commentOpened = true;
          return;
        }
        //  multi-line comment ending
        else if (!line.match(/\/\*/g) && line.match(/\*\//g)) {
          commentOpened = false;
          return;
        }
        else if (commentOpened) {
          return;
        }

        prevLines += line.trim()
          .replace(/( )*\{( )*/g, '{').replace(/( )*\}( )*/g, '}');  // for internal calculation

        // opening
        if (line.match(/\{/g)) {
          if (line.match(/@media/g) || line.match(/keyframes/g)) {
            if (insideMediaQuery) {
              reject('two media queries in file: ', originalFile);
              return;
            }
            insideMediaQuery = true;
            output += line + EOL;
          }
          else {
            selectorCache += RTL_PARENT_CLASS;
            const prevLinesMinusLastOpenBracket = prevLines.slice(0, -1);
            const lastBrackClose = prevLines.lastIndexOf('}');
            const lastBrackStart = prevLinesMinusLastOpenBracket.lastIndexOf('{');
            const fromLastBracketClosed = prevLines.slice(lastBrackClose + 1);
            if (fromLastBracketClosed.match(/@media/g) || fromLastBracketClosed.match(/keyframes/g)) {
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

        if (areChangesMade) {
          selectorCache = selectorCache.replace(/\!important;/g,';').replace(/;/g, '!important;');
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
          if (!output) {
            resolve(true);
            return;
          }
          const data = beautify(outputStart + output + outputEnd, { format: 'css' });
          if (options.returnOutputOnly) {
            resolve(data);
            return;
          }
          else if (!options.outputFile) {
            fs.appendFileSync(originalFile, data);
          }
          else {
            fs.appendFileSync(options.outputFile, data);
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
      selectorCache += `${TAB}margin: ${pixels[0]} ${pixels[3]} ${pixels[2]} ${pixels[1]};${EOL}`;
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
      selectorCache += `${TAB}margin-right:${pixelsLeft[0]} !important;${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}margin-left: unset !important;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(PX_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}margin-left:${pixelsRight[0]} !important;${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}margin-right: unset !important;${EOL}`;
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
      selectorCache += `${TAB}padding-right:${pixelsLeft[0]} !important;${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}padding-left: unset !important;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(PX_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}padding-left:${pixelsRight[0]} !important;${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}padding-right: unset !important;${EOL}`;
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
      selectorCache += `${TAB}right:${pixelsLeft[0]} !important;${EOL}`;
      areChangesMade = true;
    }
    if (!matchedRight) {
      selectorCache += `${TAB}left: unset !important;${EOL}`;
      areChangesMade = true;
    }
  }
  if (matchedRight) {
    const pixelsRight = matchedRight[0].match(PX_MATCH_REGEX);
    if (pixelsRight) {
      selectorCache += `${TAB}left:${pixelsRight[0]} !important;${EOL}`;
      areChangesMade = true;
    }
    if (!matchedLeft) {
      selectorCache += `${TAB}right: unset !important;${EOL}`;
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
