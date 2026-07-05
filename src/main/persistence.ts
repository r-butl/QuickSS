import * as fs from 'fs/promises'
import * as path from 'path'
import { Guide } from '../shared/types'
import { createGuide, parseManifest, serializeManifest } from '../shared/manifest'

/**
 * Lowercase, replace spaces/punctuation with hyphens, strip anything not
 * [a-z0-9-], and collapse repeated hyphens. Pure string function.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Writes `data` atomically by writing to a temp file in the same directory
 * as `filePath`, then renaming it into place. `rename` within the same
 * filesystem/directory is atomic on POSIX and Windows, which is why the
 * temp file must live alongside the final target rather than in a system
 * tmp dir. If the write step fails before the rename, the temp file is
 * cleaned up so no orphaned `.tmp-*` files are left behind.
 */
export async function atomicWriteFile(filePath: string, data: string | Buffer): Promise<void> {
  const dir = path.dirname(filePath)
  const tempPath = path.join(dir, `${path.basename(filePath)}.tmp-${crypto.randomUUID()}`)

  try {
    await fs.writeFile(tempPath, data)
    await fs.rename(tempPath, filePath)
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => {})
    throw err
  }
}

/**
 * Creates a new Guide folder at `<basePath>/<slugified-title>-<short-id>/`
 * with an `images/` subfolder, writes its manifest, and returns both the
 * resolved path and the new Guide.
 */
export async function createGuideFolder(
  basePath: string,
  title: string
): Promise<{ guidePath: string; guide: Guide }> {
  const guide = createGuide(title)
  const shortId = guide.id.slice(0, 8)
  const slug = slugify(title)
  const folderName = slug ? `${slug}-${shortId}` : shortId
  const guidePath = path.join(basePath, folderName)

  await fs.mkdir(path.join(guidePath, 'images'), { recursive: true })
  await writeManifest(guidePath, guide)

  return { guidePath, guide }
}

/**
 * Serializes `guide` and atomically writes it to `<guidePath>/manifest.json`.
 */
export async function writeManifest(guidePath: string, guide: Guide): Promise<void> {
  const manifestPath = path.join(guidePath, 'manifest.json')
  await atomicWriteFile(manifestPath, serializeManifest(guide))
}

/**
 * Reads and parses `<guidePath>/manifest.json` into a Guide.
 */
export async function readManifest(guidePath: string): Promise<Guide> {
  const manifestPath = path.join(guidePath, 'manifest.json')
  const contents = await fs.readFile(manifestPath, 'utf-8')
  return parseManifest(contents)
}

/**
 * Atomically writes image bytes to `<guidePath>/<imageFile>`, where
 * `imageFile` is the Step's `imageFile` field (e.g. `images/<uuid>.png`).
 */
export async function writeImage(
  guidePath: string,
  imageFile: string,
  data: Buffer
): Promise<void> {
  const imagePath = path.join(guidePath, imageFile)
  await atomicWriteFile(imagePath, data)
}
