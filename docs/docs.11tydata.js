export default {
  layout: "page.njk",
  tags: "docPages",
  permalink: (data) => `/docs/${data.page.fileSlug}/`,
};
