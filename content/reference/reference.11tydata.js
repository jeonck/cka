export default {
  layout: "page.njk",
  tags: "referencePages",
  permalink: (data) => `/reference/${data.page.fileSlug}/`,
};
