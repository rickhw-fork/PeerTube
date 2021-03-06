import { join } from 'path'

import { ThumbnailType } from '../../shared/models/videos/thumbnail.type'
import { generateImageFromVideoFile } from '../helpers/ffmpeg-utils'
import { processImage } from '../helpers/image-utils'
import { downloadImage } from '../helpers/requests'
import { CONFIG } from '../initializers/config'
import { ASSETS_PATH, PREVIEWS_SIZE, THUMBNAILS_SIZE } from '../initializers/constants'
import { ThumbnailModel } from '../models/video/thumbnail'
import { MVideoFile, MVideoThumbnail } from '../types/models'
import { MThumbnail } from '../types/models/video/thumbnail'
import { MVideoPlaylistThumbnail } from '../types/models/video/video-playlist'
import { getVideoFilePath } from './video-paths'

type ImageSize = { height: number, width: number }

function createPlaylistMiniatureFromExisting (options: {
  inputPath: string
  playlist: MVideoPlaylistThumbnail
  automaticallyGenerated: boolean
  keepOriginal?: boolean // default to false
  size?: ImageSize
}) {
  const { inputPath, playlist, automaticallyGenerated, keepOriginal = false, size } = options
  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  const thumbnailCreator = () => processImage(inputPath, outputPath, { width, height }, keepOriginal)
  return createThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    existingThumbnail
  })
}

function createPlaylistMiniatureFromUrl (options: {
  downloadUrl: string
  playlist: MVideoPlaylistThumbnail
  size?: ImageSize
}) {
  const { downloadUrl, playlist, size } = options
  const { filename, basePath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  // Only save the file URL if it is a remote playlist
  const fileUrl = playlist.isOwned()
    ? null
    : downloadUrl

  const thumbnailCreator = () => downloadImage(downloadUrl, basePath, filename, { width, height })
  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl })
}

function createVideoMiniatureFromUrl (options: {
  downloadUrl: string
  video: MVideoThumbnail
  type: ThumbnailType
  size?: ImageSize
}) {
  const { downloadUrl, video, type, size } = options
  const { filename: updatedFilename, basePath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  // Only save the file URL if it is a remote video
  const fileUrl = video.isOwned()
    ? null
    : downloadUrl

  // If the thumbnail URL did not change
  const existingUrl = existingThumbnail
    ? existingThumbnail.fileUrl
    : null

  // If the thumbnail URL did not change and has a unique filename (introduced in 3.1), avoid thumbnail processing
  const thumbnailUrlChanged = !existingUrl || existingUrl !== downloadUrl || downloadUrl.endsWith(`${video.uuid}.jpg`)

  // Do not change the thumbnail filename if the file did not change
  const filename = thumbnailUrlChanged
    ? updatedFilename
    : existingThumbnail.filename

  const thumbnailCreator = () => {
    if (thumbnailUrlChanged) return downloadImage(downloadUrl, basePath, filename, { width, height })

    return Promise.resolve()
  }

  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl })
}

function createVideoMiniatureFromExisting (options: {
  inputPath: string
  video: MVideoThumbnail
  type: ThumbnailType
  automaticallyGenerated: boolean
  size?: ImageSize
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, video, type, automaticallyGenerated, size, keepOriginal = false } = options

  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)
  const thumbnailCreator = () => processImage(inputPath, outputPath, { width, height }, keepOriginal)

  return createThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    existingThumbnail
  })
}

function generateVideoMiniature (options: {
  video: MVideoThumbnail
  videoFile: MVideoFile
  type: ThumbnailType
}) {
  const { video, videoFile, type } = options

  const input = getVideoFilePath(video, videoFile)

  const { filename, basePath, height, width, existingThumbnail, outputPath } = buildMetadataFromVideo(video, type)
  const thumbnailCreator = videoFile.isAudio()
    ? () => processImage(ASSETS_PATH.DEFAULT_AUDIO_BACKGROUND, outputPath, { width, height }, true)
    : () => generateImageFromVideoFile(input, basePath, filename, { height, width })

  return createThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated: true,
    existingThumbnail
  })
}

function createPlaceholderThumbnail (options: {
  fileUrl: string
  video: MVideoThumbnail
  type: ThumbnailType
  size: ImageSize
}) {
  const { fileUrl, video, type, size } = options
  const { filename, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  const thumbnail = existingThumbnail || new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl

  return thumbnail
}

// ---------------------------------------------------------------------------

export {
  generateVideoMiniature,
  createVideoMiniatureFromUrl,
  createVideoMiniatureFromExisting,
  createPlaceholderThumbnail,
  createPlaylistMiniatureFromUrl,
  createPlaylistMiniatureFromExisting
}

function buildMetadataFromPlaylist (playlist: MVideoPlaylistThumbnail, size: ImageSize) {
  const filename = playlist.generateThumbnailName()
  const basePath = CONFIG.STORAGE.THUMBNAILS_DIR

  return {
    filename,
    basePath,
    existingThumbnail: playlist.Thumbnail,
    outputPath: join(basePath, filename),
    height: size ? size.height : THUMBNAILS_SIZE.height,
    width: size ? size.width : THUMBNAILS_SIZE.width
  }
}

function buildMetadataFromVideo (video: MVideoThumbnail, type: ThumbnailType, size?: ImageSize) {
  const existingThumbnail = Array.isArray(video.Thumbnails)
    ? video.Thumbnails.find(t => t.type === type)
    : undefined

  if (type === ThumbnailType.MINIATURE) {
    const filename = video.generateThumbnailName()
    const basePath = CONFIG.STORAGE.THUMBNAILS_DIR

    return {
      filename,
      basePath,
      existingThumbnail,
      outputPath: join(basePath, filename),
      height: size ? size.height : THUMBNAILS_SIZE.height,
      width: size ? size.width : THUMBNAILS_SIZE.width
    }
  }

  if (type === ThumbnailType.PREVIEW) {
    const filename = video.generatePreviewName()
    const basePath = CONFIG.STORAGE.PREVIEWS_DIR

    return {
      filename,
      basePath,
      existingThumbnail,
      outputPath: join(basePath, filename),
      height: size ? size.height : PREVIEWS_SIZE.height,
      width: size ? size.width : PREVIEWS_SIZE.width
    }
  }

  return undefined
}

async function createThumbnailFromFunction (parameters: {
  thumbnailCreator: () => Promise<any>
  filename: string
  height: number
  width: number
  type: ThumbnailType
  automaticallyGenerated?: boolean
  fileUrl?: string
  existingThumbnail?: MThumbnail
}) {
  const {
    thumbnailCreator,
    filename,
    width,
    height,
    type,
    existingThumbnail,
    automaticallyGenerated = null,
    fileUrl = null
  } = parameters

  const oldFilename = existingThumbnail && existingThumbnail.filename !== filename
    ? existingThumbnail.filename
    : undefined

  const thumbnail: MThumbnail = existingThumbnail || new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl
  thumbnail.automaticallyGenerated = automaticallyGenerated

  if (oldFilename) thumbnail.previousThumbnailFilename = oldFilename

  await thumbnailCreator()

  return thumbnail
}
