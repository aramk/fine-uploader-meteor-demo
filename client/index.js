window.qq = require('../node_modules/fine-uploader/s3.fine-uploader/s3.fine-uploader.js');

$(() => {
  // Some options to pass to the uploader are discussed on the next page
  const uploader = new qq.s3.FineUploader({
    element: $('#uploader')[0]
  });
});
