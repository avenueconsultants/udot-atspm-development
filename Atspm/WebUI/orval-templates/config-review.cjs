module.exports = (specification) => ({
  ...specification,
  paths: Object.fromEntries(
    Object.entries(specification.paths).filter(([path]) =>
      path.startsWith('/ConfigReview')
    )
  ),
  components: {
    schemas: Object.fromEntries(
      Object.entries(specification.components.schemas).filter(([name]) =>
        name.startsWith('ConfigReview')
      )
    ),
  },
})
