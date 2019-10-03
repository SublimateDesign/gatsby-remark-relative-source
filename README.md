# gatsby-remark-relative-source

Converts sources in markdown to be relative to their node's parent directory. Based on [gatsby-remark-relative-images](https://github.com/danielmahon/gatsby-remark-relative-images), this plugin expands its functionality so paths can be processed from any raw markdown html node attribute rather than hard-coded to img src. This will help [gatsby-remark-images](https://github.com/gatsbyjs/gatsby/tree/master/packages/gatsby-remark-images) match images outside the node folder, and through configuration allow other plugins expecting relative source to work (such as [gatsby-remark-custom-image-component](https://github.com/d4rekanguok/gatsby-remark-custom-image-component/blob/master/src/index.js)). For example, use with NetlifyCMS.

NOTE: As stated in the original [gatsby-remark-relative-images](https://github.com/danielmahon/gatsby-remark-relative-images), this was built for use with NetlifyCMS and should be considered a temporary solution until relative paths are supported. If it works for other use cases then great!

## Install

`npm install --save gatsby-remark-relative-source`

## How to use

```javascript
// gatsby-config.js
plugins: [
  // Add static assets before markdown files
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      path: `${__dirname}/static/uploads`,
      name: 'uploads',
    },
  },
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      path: `${__dirname}/src/pages`,
      name: 'pages',
    },
  },
  {
    resolve: `gatsby-transformer-remark`,
    options: {
      plugins: [
        // gatsby-remark-relative-source must
        // go before gatsby-remark-images and other plugins needing relative sources
        {
          resolve: `gatsby-remark-relative-source`,
          options: {
            name: `uploads`,
            htmlSources: [{tagName: `post-video`, attributes: [`image`]}] // post-video is a component referenced later by gatsby-remark-custom-image-component
          },
        },
        {
          resolve: `gatsby-remark-images`,
          options: {
            // It's important to specify the maxWidth (in pixels) of
            // the content container as this plugin uses this as the
            // base for generating different widths of each image.
            maxWidth: 590,
          },
        },
        {
          resolve: `gatsby-remark-custom-image-component`,
          options: {
            // plugin options
            componentName: 'post-video',
            imagePropName: 'image',
            sharpMethod: 'fluid',
            // fluid's arguments
            quality: 80,
            maxWidth: 2048,
          }
        },
      ],
    },
  },
];
```

```markdown example

<post-video url="https://vimeo.com/yourvideoid" image="/img/updated-by-gatsby-remark-relative-source"></post-video>

```

### To convert frontmatter images 

Use the exported function `fmImagesToRelative` in your `gatsby-node.js`. This takes every node returned by your gatsby-source plugins and converts any absolute paths in markdown frontmatter data into relative paths if a matching file is found.

```js
// gatsby-node.js
const { fmImagesToRelative } = require('gatsby-remark-relative-source');

exports.onCreateNode = ({ node }) => {
  fmImagesToRelative(node);
};
```

## FAQs

### I'm getting the error: Field "image" must not have a selection since type "String" has no subfields
This is a common error when working with Netlify CMS (see issue [gatsby/gatsby#5990](https://github.com/gatsbyjs/gatsby/issues/5990)).

The application must include the `media` with `gatsby-source-filesystem` to include all the uploaded media and to make it available on build time. **Note:** The media folder must be included **before** the other content.

For example, an application that is using NetlifyCMS and this plugin, and has a content folder with markdown that comes from Netlify. Here's how the `gatsby-config.js` should look like:

```js
module.exports = {
  plugins: [
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/static/assets`,
        name: 'assets',
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/src/content`,
        name: 'content',
      },
    },
    `gatsby-transformer-sharp`,
    `gatsby-plugin-sharp`,
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          `gatsby-remark-relative-source`,
          {
            resolve: `gatsby-remark-images`,
            options: {},
          },
        ],
      },
    },
    `gatsby-plugin-netlify-cms`,
  ],
}
```