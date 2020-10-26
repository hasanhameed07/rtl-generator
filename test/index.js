const { describe, it } = require('mocha');
const chai = require('chai');
const { expect } = chai;
const chaiFiles = require('chai-files');
chai.use(chaiFiles);
const file = chaiFiles.file;
const rtlGenerator = require('../index');
const fs = require('fs');

describe('rtl-generator test cases', function () {
    it('float test', async function () {
        // const result = await rtlGenerator({
        //     // inputFiles: [
        //     //     // '/Users/mac/Projects/iraqi-souq-buyer/src/assets/scss/style.css',
        //     //     '/Users/mac/Projects/iraqi-souq-buyer/src/app/banner/banner.component.css',
        //     //     '/Users/mac/Projects/iraqi-souq-buyer/src/app/cart/components/cart.css',
        //     //     '/Users/mac/Projects/iraqi-souq-buyer/src/app/core/components/footer/footer.component.css',
        //     //     '/Users/mac/Projects/iraqi-souq-buyer/src/app/core/components/header/header.component.scss',
        //     //     '/Users/mac/Projects/iraqi-souq-buyer/src/app/order/components/invoice/invoice.component.css',
        //     //     '/Users/mac/Projects/iraqi-souq-buyer/src/app/order/components/order-box/order-box.component.css',
        //     //     '/Users/mac/Projects/iraqi-souq-buyer/src/app/order/components/view/view.component.css',
        //     // ]
        //     folderPath: '/Users/mac/Projects/iraqi-souq-buyer/src/'
        // });
        // expect(result[0]).to.equal(file('./test/float-rtl.css'));
    });

    // it('margin test', async function () {
    //     const result = await rtlGenerator({
    //         returnOutputOnly: true,
    //         inputFiles: ['./test/margin.css']
    //     });
    //     expect(result[0]).to.equal(file('./test/margin-rtl.css'));
    // });
    it('margin test', async function () {
        const result = await rtlGenerator({
            returnOutputOnly: true,
            inputFiles: ['./test/comments.css']
        });
        expect(result[0]).to.equal(file('./test/margin-rtl.css'));
    });
});
