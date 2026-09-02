export default {
  layout: "domain.njk",
  tags: "domainPages",
  permalink: (data) => `/domains/${data.page.fileSlug}/`,
};
