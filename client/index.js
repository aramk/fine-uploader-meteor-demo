window.qq = require('../node_modules/fine-uploader/fine-uploader/fine-uploader.js');

$(() => {
  // Some options to pass to the uploader are discussed on the next page
  const uploader = new qq.FineUploader({
    element: $('#uploader')[0],
    debug: true,
    request: {
      endpoint: 'http://localhost:8000/s3handler'
    },
    deleteFile: {
      enabled: true,
      endpoint: 'http://localhost:8000/s3handler'
    }
  });
});
