# rtl-generator
A utility to convert any existing left-to-right written css files into right-to-left css.

Suppose you have a website in English (left-to-right) and now you want a way to save manual work by means of automatically generating a right-to-left css. 

This utility generates only the code which is modified for rtl. Unlike the `css-flip` from Twitter which generates css files containing all the untouched css.

## Features

- Generate only converted rtl code required for proper right-to-left UI.
- Handles and preserves css inside *media queries* for responsiveness.
- Provide multiple input files
- Output, Append or Write to a new file

## How it works

1. Install the npm utility
2. Require it in your nodejs project or create a new index.html for conversion
3. Provide input ltr css files 
4. Thats it! The rtl css code will be appended to the input source files with a parent .rtl class. 

## Installation

```sh
npm install rtl-generator -g
```

## Usage

Output the rtl css

```js
var rtlGenerator = require('rtl-generator');
const result = await rtlGenerator({
    returnOutputOnly: true,
    inputFiles: ['./ltr/style.css']
});
```

Append rtl css to the same file

```js
var rtlGenerator = require('rtl-generator');
const result = await rtlGenerator({
    inputFiles: ['./ltr/style.css']
});
```

Write rtl to a new css file

```js
var rtlGenerator = require('rtl-generator');
const result = await rtlGenerator({
    inputFiles: ['./ltr/style.css', './ltr/style-more.css'],
    outputFile: ['./ltr/style-rtl-combined.css']
});
```

## Supported CSS Properties
- float
- text-align
- margin
- margin-left
- margin-right
- padding
- padding-left
- padding-right
- left
- right
- border-left
- border-right
- border-left-color
- border-right-color
- border-left-style
- border-right-style
- border-left-width
- border-right-width

## Skip properties declaration

You can skip the lines which you do not want to be converted by placing a special directive above the desired property.

Source:

```css
p {
  /*skip-rtl-conversion-below-line*/ 
  float: left;
  text-direction: left;
}
```

Output:

```css
.rtl p {
  text-direction: right;
}
```

## Options

 * inputFiles: array[string] (required)
 * outputFile: string (optional)
 * rtlParentClass: string (default: .rtl)
 * returnOutputOnly: boolean (default: false) // do not write to any file instead return the output


## Examples

Source:
```css
.margin-of-four {
  margin: 0 10px 40px 20px;
}
.margin-both {
  margin-left: 5px;
  margin-right: 10px;
}
```

Output:
```css
.rtl .margin-of-four {
    margin: 0 20px 10px 40px;
}
.rtl .margin-both {
    margin-right: 5px;
    margin-left: 10px;
}
```


@author
Hasan Hameed
