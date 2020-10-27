const { describe, it } = require('mocha');
const chai = require('chai');
const { expect } = chai;
const chaiFiles = require('chai-files');
chai.use(chaiFiles);
const file = chaiFiles.file;
const rtlGenerator = require('../index');

describe('rtl-generator test cases', function () {
    it('keyframes test', async function () {
        const result = await rtlGenerator({
            returnOutputOnly: true,
            inputFiles: ['./test/keyframes.css']
        });
        expect(result[0]).to.equal(file('./test/keyframes-rtl.css'));
    });
    it('float test', async function () {
        const result = await rtlGenerator({
            returnOutputOnly: true,
            inputFiles: ['./test/float.css']
        });
        expect(result[0]).to.equal(file('./test/float-rtl.css'));
    });
    it('margin test', async function () {
        const result = await rtlGenerator({
            returnOutputOnly: true,
            inputFiles: ['./test/margin.css']
        });
        expect(result[0]).to.equal(file('./test/margin-rtl.css'));
    });
    it('comments test', async function () {
        const result = await rtlGenerator({
            returnOutputOnly: true,
            inputFiles: ['./test/comments.css']
        });
        expect(result[0]).to.equal(file('./test/comments-rtl.css'));
    });
});
