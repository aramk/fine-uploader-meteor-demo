window.qq = require('../node_modules/fine-uploader/fine-uploader/fine-uploader.js');

$(() => {
  const uploader = new qq.FineUploader({
    element: $('#uploader')[0],
    debug: true,
    request: {
      endpoint: 'http://localhost:8000/uploads'
    },
    deleteFile: {
      enabled: true,
      endpoint: 'http://localhost:8000/uploads'
    }
  });
});
