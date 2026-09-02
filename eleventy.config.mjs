import { HtmlBasePlugin } from "@11ty/eleventy";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ "site/assets": "assets" });

  const md = markdownIt({ html: true, linkify: false, typographer: false })
    .use(markdownItAnchor, { permalink: markdownItAnchor.permalink.headerLink() });
  eleventyConfig.setLibrary("md", md);

  // Render a markdown string from data (used by the mnemonics page and PDF).
  eleventyConfig.addFilter("md", (s) => (s ? md.renderInline(String(s)) : ""));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("byDomain", (items, domain) =>
    (items || []).filter((i) => i.domain === domain)
  );
  eleventyConfig.addFilter("sortBy", (arr, key) =>
    [...(arr || [])].sort((a, b) => (a.data?.[key] ?? 0) - (b.data?.[key] ?? 0))
  );

  return {
    dir: {
      input: ".",
      output: "dist",
      includes: "site/_includes",
      data: "site/_data",
    },
    pathPrefix: process.env.PATH_PREFIX || "/",
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
}
