/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser,
  flushTests,
  getBlacklistedVideosList,
  killallServers,
  makePostBodyRequest,
  makePutBodyRequest,
  removeVideoFromBlacklist,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'

describe('Test video blacklist API validators', function () {
  let server: ServerInfo
  let notBlacklistedVideoId: number
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await createUser(server.url, server.accessToken, username, password)
    userAccessToken = await userLogin(server, { username, password })

    {
      const res = await uploadVideo(server.url, server.accessToken, {})
      server.video = res.body.video
    }

    {
      const res = await uploadVideo(server.url, server.accessToken, {})
      notBlacklistedVideoId = res.body.video.uuid
    }
  })

  describe('When adding a video in blacklist', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with nothing', async function () {
      const path = basePath + server.video + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields })
    })

    it('Should fail with a non authenticated user', async function () {
      const path = basePath + server.video + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a non admin user', async function () {
      const path = basePath + server.video + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 403 })
    })

    it('Should fail with an invalid reason', async function () {
      const path = basePath + server.video.uuid + '/blacklist'
      const fields = { reason: 'a'.repeat(305) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const path = basePath + server.video.uuid + '/blacklist'
      const fields = { }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When updating a video in blacklist', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields })
    })

    it('Should fail with a video not blacklisted', async function () {
      const path = '/api/v1/videos/' + notBlacklistedVideoId + '/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with a non authenticated user', async function () {
      const path = basePath + server.video + '/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a non admin user', async function () {
      const path = basePath + server.video + '/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 403 })
    })

    it('Should fail with an invalid reason', async function () {
      const path = basePath + server.video.uuid + '/blacklist'
      const fields = { reason: 'a'.repeat(305) }

      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const path = basePath + server.video.uuid + '/blacklist'
      const fields = { reason: 'hello' }

      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When removing a video in blacklist', function () {
    it('Should fail with a non authenticated user', async function () {
      await removeVideoFromBlacklist(server.url, 'fake token', server.video.uuid, 401)
    })

    it('Should fail with a non admin user', async function () {
      await removeVideoFromBlacklist(server.url, userAccessToken, server.video.uuid, 403)
    })

    it('Should fail with an incorrect id', async function () {
      await removeVideoFromBlacklist(server.url, server.accessToken, 'hello', 400)
    })

    it('Should fail with a not blacklisted video', async function () {
      // The video was not added to the blacklist so it should fail
      await removeVideoFromBlacklist(server.url, server.accessToken, notBlacklistedVideoId, 404)
    })

    it('Should succeed with the correct params', async function () {
      await removeVideoFromBlacklist(server.url, server.accessToken, server.video.uuid, 204)
    })
  })

  describe('When listing videos in blacklist', function () {
    const basePath = '/api/v1/videos/blacklist/'

    it('Should fail with a non authenticated user', async function () {
      await getBlacklistedVideosList(server.url, 'fake token', 401)
    })

    it('Should fail with a non admin user', async function () {
      await getBlacklistedVideosList(server.url, userAccessToken, 403)
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, basePath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, basePath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, basePath, server.accessToken)
    })
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
