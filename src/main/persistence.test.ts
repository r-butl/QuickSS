import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  atomicWriteFile,
  createGuideFolder,
  readManifest,
  slugify,
  writeImage,
  writeManifest
} from './persistence'
import { addStepToThread, createGuide, createThread } from '../shared/manifest'
import { Step } from '../shared/types'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'doctool-persistence-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('My Guide Title')).toBe('my-guide-title')
  })

  it('strips punctuation', () => {
    expect(slugify('Hello, World! It\'s a "Test"')).toBe('hello-world-it-s-a-test')
  })

  it('handles mixed case', () => {
    expect(slugify('CamelCaseTitle')).toBe('camelcasetitle')
  })

  it('collapses repeated separators', () => {
    expect(slugify('Too   Many---Spaces___Here')).toBe('too-many-spaces-here')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  --Leading and Trailing--  ')).toBe('leading-and-trailing')
  })
})

describe('atomicWriteFile', () => {
  it('writes the file and leaves no .tmp-* files behind on success', async () => {
    const dir = await makeTempDir()
    const targetPath = path.join(dir, 'file.txt')

    await atomicWriteFile(targetPath, 'hello world')

    const contents = await fs.readFile(targetPath, 'utf-8')
    expect(contents).toBe('hello world')

    const entries = await fs.readdir(dir)
    expect(entries).toEqual(['file.txt'])
    expect(entries.some((name) => name.includes('.tmp-'))).toBe(false)
  })

  it('cleans up the temp file if the write step fails', async () => {
    const dir = await makeTempDir()
    // Target inside a directory that does not exist, so writing the temp
    // file (in the same, nonexistent directory) fails before any rename.
    const targetPath = path.join(dir, 'missing-subdir', 'file.txt')

    await expect(atomicWriteFile(targetPath, 'data')).rejects.toThrow()

    const entries = await fs.readdir(dir)
    expect(entries).toEqual([])
  })
})

describe('createGuideFolder', () => {
  it('creates the expected folder structure and returns a valid Guide', async () => {
    const basePath = await makeTempDir()

    const { guidePath, guide } = await createGuideFolder(basePath, 'My Test Guide')

    expect(guidePath.startsWith(basePath)).toBe(true)
    expect(path.basename(guidePath)).toMatch(/^my-test-guide-[a-f0-9]{8}$/)

    const manifestStat = await fs.stat(path.join(guidePath, 'manifest.json'))
    expect(manifestStat.isFile()).toBe(true)

    const imagesStat = await fs.stat(path.join(guidePath, 'images'))
    expect(imagesStat.isDirectory()).toBe(true)

    expect(guide.title).toBe('My Test Guide')
    expect(guide.manifestVersion).toBe(1)
  })
})

describe('writeManifest / readManifest', () => {
  it('round-trips a Guide with a Thread and a Step', async () => {
    const basePath = await makeTempDir()
    const guidePath = path.join(basePath, 'guide-folder')
    await fs.mkdir(guidePath, { recursive: true })

    let guide = createGuide('Round Trip Guide')
    const { guide: guideWithThread, thread } = createThread(guide, 'First Thread')
    guide = guideWithThread

    const step: Step = {
      id: 'step-1',
      imageFile: 'images/step-1.png',
      caption: 'First Step',
      description: 'A description',
      cursor: { x: 10, y: 20, visible: true },
      crop: { x: 0, y: 0, width: 100, height: 100 },
      createdAt: new Date().toISOString()
    }
    guide = addStepToThread(guide, thread.id, step)

    await writeManifest(guidePath, guide)
    const readBack = await readManifest(guidePath)

    expect(readBack).toEqual(guide)
  })
})

describe('writeImage', () => {
  it('writes bytes that round-trip byte-for-byte', async () => {
    const basePath = await makeTempDir()
    const guidePath = path.join(basePath, 'guide-folder')
    await fs.mkdir(path.join(guidePath, 'images'), { recursive: true })

    const data = Buffer.from([0, 1, 2, 3, 255, 254, 253, 10, 13, 0])
    await writeImage(guidePath, 'images/test-image.bin', data)

    const readBack = await fs.readFile(path.join(guidePath, 'images', 'test-image.bin'))
    expect(readBack.equals(data)).toBe(true)
  })

  it('leaves no .tmp-* files behind after writing an image', async () => {
    const basePath = await makeTempDir()
    const guidePath = path.join(basePath, 'guide-folder')
    await fs.mkdir(path.join(guidePath, 'images'), { recursive: true })

    await writeImage(guidePath, 'images/test-image.bin', Buffer.from([1, 2, 3]))

    const entries = await fs.readdir(path.join(guidePath, 'images'))
    expect(entries).toEqual(['test-image.bin'])
  })
})
