const ProductionStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
} as const

export type ProductionStatus = (typeof ProductionStatus)[keyof typeof ProductionStatus]
export default ProductionStatus
