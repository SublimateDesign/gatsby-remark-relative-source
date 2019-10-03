const select = require(`unist-util-select`);
const path = require(`path`);
const isRelativeUrl = require(`is-relative-url`);
const _ = require(`lodash`);
const cheerio = require(`cheerio`);
const slash = require(`slash`);
const deepMap = require("deep-map");
const polyfill = require(`babel-polyfill`);

// If the source is relative (not hosted elsewhere)
// 1. Find the source file
// 2. Convert the source attribute to be relative to its parent node
// This will allow plugins dependent on relative sources (gatsby-remark-images, gatsby-remark-image-custom-component, etc) to resolve correctly
module.exports = ({ files, markdownNode, markdownAST, pathPrefix, getNode, reporter }, pluginOptions) => {
	const defaults = {};

    const options = _.defaults(pluginOptions, defaults);  

    let htmlSources = [];
    if (options.htmlSources && options.htmlSources.length) {
        for (let source of options.htmlSources) {
            if (source.tagName && source.attributes && Array.isArray(source.attributes) && source.attributes.length) {
                htmlSources.push(source);
            }
            else {
                reporter.error(`${JSON.stringify(source)} is an invalid source definition object. Ensure properties "tagName" (string) and "attributes" (array of strings) are set.`);
            }
        }
    }
    if (!options.excludeImgNodes) {
        // ensure img elements are included unless explicitly excluded
        var exisingImgNode = _.find(htmlSources, node => { 
            if (node.tagName === `img`) {
                return node;
            }
        });
        if (!exisingImgNode) {
            htmlSources.push({tagName: `img`, attributes: [`src`]});
        }
    }

	// This will only work for markdown syntax image tags
	const markdownImageNodes = select(markdownAST, `image`);

	// This will also allow the use of html image tags
	const rawHtmlNodes = select(markdownAST, `html`);

	// Promise markdown images in body
	Promise.all(
		// Simple because there is no nesting in markdown
		markdownImageNodes.map(
			node =>
				new Promise(async (resolve, reject) => {
					// Only handle relative (local) urls
					if (!isRelativeUrl(node.url)) {
						return resolve();
					}
					let imagePath;
					// See if there is a matching file path from gatsby-source-filesystem
					const imageNode = _.find(files, file => {
						imagePath = path.join(file.dir, path.basename(node.url));
						return slash(path.normalize(file.absolutePath)) === slash(imagePath);
					});
					// Return if we didn't find a match
					if (!imageNode) return resolve();
					// Get the markdown file's parent directory
					const parentDirectory = getNode(markdownNode.parent).dir;
					// Make the image src relative to the markdown file
					node.url = slash(path.relative(parentDirectory, imagePath));
					// Return modified node
					return resolve(node);
				})
		)
	).then(markdownImageNodes =>
		// Process HTML images in markdown body
		Promise.all(
			// Complex because HTML nodes can contain multiple images
			rawHtmlNodes.map(
				node =>
					new Promise(async (resolve, reject) => {
						if (!node.value) {
							return resolve();
						}

                        const $ = cheerio.load(node.value);

                        let imageRefs = [];
                        // add any elements matching tagName set in the check node definitions
                        for (let source of htmlSources) {
                            $(source.tagName).each(function() {
                                imageRefs.push($(this));
                            });
                        }
                        if (!imageRefs.length) {
                            // No matching elements
                            return resolve();
                        }

						for (let thisImg of imageRefs) {
							// Get the details we need.
                            let formattedImgTag = {};
                            // get the matching check node definition to determine the source for this element
                            var source = _.find(htmlSources, source => { 
                                if (source.tagName === (thisImg[0].tagName || thisImg[0].name)) {
                                    return source;
                                }
                            });
                            if (!source) {
                                return resolve();
                            }

                            let sourcesUpdated = false;
                            for (let sourceAttribute of source.attributes) {
                                formattedImgTag.url = thisImg.attr(sourceAttribute);
                                if (!formattedImgTag.url) {
                                    continue;
                                }
                                // Only handle relative (local) urls
                                if (!isRelativeUrl(formattedImgTag.url)) {
                                    continue;
                                }

                                let imagePath;
                                const imageNode = _.find(files, file => {
                                    if (file.sourceInstanceName === options.name) {
                                        imagePath = path.join(file.dir, path.basename(formattedImgTag.url));
                                        return slash(path.normalize(file.absolutePath)) === slash(imagePath);
                                    }
                                });

                                if (!imageNode) continue;

                                const parentNode = getNode(markdownNode.parent);
                                // Make the image src relative to its parent node
                                thisImg.attr(sourceAttribute, slash(path.relative(parentNode.dir, imagePath)));
                                sourcesUpdated = true;
                            }
                            if (!sourcesUpdated)
                                return resolve(); // no updates applied

							node.value = $(`body`).html(); // fix for cheerio v1
						}
						return resolve(node);
					})
			)
		).then(htmlImageNodes => markdownImageNodes.concat(htmlImageNodes).filter(node => !!node))
	);
};

const fileNodes = [];

module.exports.fmImagesToRelative = node => {
	// Save file references
	fileNodes.push(node);
	// Only process markdown files
	if (node.internal.type === `MarkdownRemark` || node.internal.type === `Mdx`) {
		// Convert paths in frontmatter to relative
		function makeRelative(value) {
			if (_.isString(value) && path.isAbsolute(value)) {
				let imagePath;
				const foundImageNode = _.find(fileNodes, file => {
					if (!file.dir) return;
					imagePath = path.join(file.dir, path.basename(value));
					return slash(path.normalize(file.absolutePath)) === slash(imagePath);
				});
				if (foundImageNode) {
					return slash(path.relative(path.join(node.fileAbsolutePath, ".."), imagePath));
				}
			}
			return value;
		}
		// Deeply iterate through frontmatter data for absolute paths
		deepMap(node.frontmatter, makeRelative, { inPlace: true });
	}
};