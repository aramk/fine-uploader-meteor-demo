window.qq = require('../node_modules/fine-uploader/s3.fine-uploader/s3.fine-uploader.js');

const URL_PREFIX = '/fine-uploader/s3';

const TemplateClass = Template.fineUploader;

TemplateClass.onRendered(function() {
  // Some options to pass to the uploader are discussed on the next page
  this.uploader = new qq.s3.FineUploader({
    element: $('.fine-uploader')[0],
    template: $('[data-id="fine-uploader-template"]')[0],
    debug: true,
    request: {
      endpoint: `${Meteor.settings.public.s3.bucket}.s3.amazonaws.com`,
      accessKey: Meteor.settings.public.s3.accessKeyId
    },
    signature: {
      endpoint: `${URL_PREFIX}/signature`
    },
    uploadSuccess: {
      endpoint: `${URL_PREFIX}/success`
    },
    iframeSupport: {
      localBlankPagePath: `${URL_PREFIX}/success.html`
    },
    deleteFile: {
      enabled: true,
      endpoint: `${URL_PREFIX}/s3/handler`
    }
  });
});

