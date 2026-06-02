const LinkType = {
  EMBED: 'embed',
  SIMPLE: 'simple',
} as const

export type LinkType = (typeof LinkType)[keyof typeof LinkType]
export default LinkType
