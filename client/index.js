window.qq = require('../node_modules/fine-uploader/s3.fine-uploader/s3.fine-uploader.js');

$(() => {
  // Some options to pass to the uploader are discussed on the next page
  const uploader = new qq.s3.FineUploader({
    element: $('#uploader')[0],
    debug: true,
    request: {
      endpoint: Meteor.settings.public.s3.bucket + '.s3.amazonaws.com',
      accessKey: Meteor.settings.public.s3.accessKeyId
    },
    signature: {
      endpoint: 'http://localhost:8000/s3/signature'
    },
    uploadSuccess: {
      endpoint: 'http://localhost:8000/s3/success'
    },
    iframeSupport: {
      localBlankPagePath: 'http://localhost:8000/s3/success.html'
    },
    deleteFile: {
      enabled: true,
      endpoint: 'http://localhost:8000/s3/handler'
    }
  });
});
