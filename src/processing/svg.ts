import type { BadgePreset, ImageFormat, SponsifyRenderOptions, Sponsor, Sponsorship } from '../types'
import { resizeImage } from './image'

let id = 0
export function genSvgImage(
  x: number,
  y: number,
  size: number,
  radius: number,
  base64Image: string,
  imageFormat: ImageFormat,
) {
  const cropId = `c${id++}`
  return `
  <clipPath id="${cropId}">
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * radius}" ry="${size * radius}" />
  </clipPath>
  <image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/${imageFormat};base64,${base64Image}" clip-path="url(#${cropId})"/>`
}

export async function generateBadge(
  x: number,
  y: number,
  sponsor: Sponsor,
  preset: BadgePreset,
  radius: number,
  imageFormat: ImageFormat,
) {
  const { login } = sponsor
  let name = (sponsor.name || sponsor.login).trim()
  const url = sponsor.websiteUrl || sponsor.linkUrl

  if (preset.name && preset.name.maxLength && name.length > preset.name.maxLength) {
    if (name.includes(' '))
      name = name.split(' ')[0]
    else
      name = `${name.slice(0, preset.name.maxLength - 3)}...`
  }

  const { size } = preset.avatar
  let avatar = sponsor.avatarBuffer!
  if (size < 50) {
    avatar = await resizeImage(avatar, 50, imageFormat)
  }
  else if (size < 80) {
    avatar = await resizeImage(avatar, 80, imageFormat)
  }
  else if (imageFormat === 'png') {
    avatar = await resizeImage(avatar, 120, imageFormat)
  }

  const avatarBase64 = avatar.toString('base64')

  return `<a ${url ? `href="${url}" ` : ''}class="${preset.classes || 'sponsify-link'}" target="_blank" id="${login}">
  ${preset.name
    ? `<text x="${x + size / 2}" y="${y + size + 18}" text-anchor="middle" class="${preset.name.classes || 'sponsify-name'}" fill="${preset.name.color || 'currentColor'}">${encodeHtmlEntities(name)}</text>
  `
    : ''}${genSvgImage(x, y, size, radius, avatarBase64, imageFormat)}
</a>`.trim()
}

export class SvgComposer {
  height = 0
  body = ''

  constructor(public readonly config: Required<SponsifyRenderOptions>) {}

  addSpan(height = 0) {
    this.height += height
    return this
  }

  addTitle(text: string, classes = 'sponsify-tier-title') {
    return this.addText(text, classes)
  }

  addText(text: string, classes = 'text') {
    this.body += `<text x="${this.config.width / 2}" y="${this.height}" text-anchor="middle" class="${classes}">${text}</text>`
    this.height += 20
    return this
  }

  addRaw(svg: string) {
    this.body += svg
    return this
  }

  async addSponsorLine(sponsors: Sponsorship[], preset: BadgePreset) {
    const offsetX = (this.config.width - sponsors.length * preset.boxWidth) / 2 + (preset.boxWidth - preset.avatar.size) / 2
    const sponsorLine = await Promise.all(sponsors
      .map(async (s, i) => {
        const x = offsetX + preset.boxWidth * i
        const y = this.height
        const radius = s.sponsor.type === 'Organization' ? 0.1 : 0.5
        return await generateBadge(x, y, s.sponsor, preset, radius, this.config.imageFormat)
      }))

    this.body += sponsorLine.join('\n')
    this.height += preset.boxHeight
  }

  async addSponsorGrid(sponsors: Sponsorship[], preset: BadgePreset) {
    const perLine = Math.floor((this.config.width - (preset.container?.sidePadding || 0) * 2) / preset.boxWidth)

    for (let i = 0; i < Math.ceil(sponsors.length / perLine); i++) {
      await this.addSponsorLine(sponsors.slice(i * perLine, (i + 1) * perLine), preset)
    }

    return this
  }

  generateSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${this.config.width} ${this.height}" width="${this.config.width}" height="${this.height}">
<!-- Generated by https://github.com/khulnasoft-bot/sponsorskit -->
<style>${this.config.svgInlineCSS}</style>
${this.body}
</svg>
`
  }
}

function encodeHtmlEntities(str: string) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
