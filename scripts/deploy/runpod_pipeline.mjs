import { spawn } from 'node:child_process'
import https from 'node:https'
import fs from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const mode = args[0] || 'deploy'

const CONFIG = {
  apiKey: process.env.RUNPOD_API_KEY,
  endpointStaging: process.env.RUNPOD_ENDPOINT_ID_STAGING,
  endpointProd: process.env.RUNPOD_ENDPOINT_ID_PROD,
  graphqlUrl: process.env.RUNPOD_GRAPHQL_URL || 'https://api.runpod.io/graphql',
  imageField: process.env.RUNPOD_ENDPOINT_IMAGE_FIELD || 'containerImage',
  dockerImage: process.env.DOCKER_IMAGE,
  dockerTag: process.env.DOCKER_TAG,
  stagingBaseUrl: process.env.STAGING_BASE_URL || process.env.GT_BASE_URL_STAGING,
  goldenTestsEnv: process.env.GT_ENV || 'staging'
}

const LAST_PROD_FILE = path.join('scripts', 'deploy', 'last_prod_image.txt')

function requireEnv(name, value) {
  if (!value) {
    console.error(`[Pipeline] Missing env: ${name}`)
    process.exit(1)
  }
}

function runCommand(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env }
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} failed with code ${code}`))
    })
  })
}

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables })
    const req = https.request(CONFIG.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.apiKey}`
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.errors) return reject(json.errors)
          resolve(json.data)
        } catch (err) {
          reject(err)
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function getEndpointInfo(id) {
  const query = `query ($id: String!) { endpoint(id: $id) { id name ${CONFIG.imageField} } }`
  const data = await gql(query, { id })
  return data.endpoint
}

async function updateEndpointImage(id, image) {
  const input = { id, [CONFIG.imageField]: image }
  const mutation = `mutation saveEndpoint($input: EndpointInput!) { saveEndpoint(input: $input) { id } }`
  await gql(mutation, { input })
}

async function deployStaging() {
  requireEnv('RUNPOD_API_KEY', CONFIG.apiKey)
  requireEnv('RUNPOD_ENDPOINT_ID_STAGING', CONFIG.endpointStaging)
  requireEnv('DOCKER_IMAGE', CONFIG.dockerImage)
  requireEnv('DOCKER_TAG', CONFIG.dockerTag)

  const fullTag = `${CONFIG.dockerImage}:${CONFIG.dockerTag}`

  console.log(`[Pipeline] Build image ${fullTag}`)
  await runCommand('docker', ['build', '-t', fullTag, '-f', 'Dockerfile', '.'])

  console.log(`[Pipeline] Push image ${fullTag}`)
  await runCommand('docker', ['push', fullTag])

  console.log(`[Pipeline] Update staging endpoint ${CONFIG.endpointStaging}`)
  await updateEndpointImage(CONFIG.endpointStaging, fullTag)

  console.log('[Pipeline] Run Golden Tests on staging')
  requireEnv('STAGING_BASE_URL', CONFIG.stagingBaseUrl)
  await runCommand('node', ['scripts/golden-tests/run.mjs'], {
    GT_BASE_URL: CONFIG.stagingBaseUrl,
    GT_ENV: CONFIG.goldenTestsEnv
  })

  return fullTag
}

async function promoteToProd(imageTag) {
  requireEnv('RUNPOD_ENDPOINT_ID_PROD', CONFIG.endpointProd)
  const current = await getEndpointInfo(CONFIG.endpointProd)
  if (current?.[CONFIG.imageField]) {
    await fs.writeFile(LAST_PROD_FILE, String(current[CONFIG.imageField]), 'utf8')
    console.log(`[Pipeline] Saved previous prod image to ${LAST_PROD_FILE}`)
  }
  console.log(`[Pipeline] Promote image to prod ${CONFIG.endpointProd}`)
  await updateEndpointImage(CONFIG.endpointProd, imageTag)
}

async function rollbackProd() {
  requireEnv('RUNPOD_API_KEY', CONFIG.apiKey)
  requireEnv('RUNPOD_ENDPOINT_ID_PROD', CONFIG.endpointProd)
  requireEnv('DOCKER_IMAGE', CONFIG.dockerImage)
  requireEnv('DOCKER_TAG', CONFIG.dockerTag)

  const fullTag = `${CONFIG.dockerImage}:${CONFIG.dockerTag}`
  console.log(`[Pipeline] Rollback prod to ${fullTag}`)
  await updateEndpointImage(CONFIG.endpointProd, fullTag)
}

async function main() {
  if (mode === 'rollback') {
    await rollbackProd()
    return
  }

  const stagingInfo = await getEndpointInfo(CONFIG.endpointStaging)
  console.log(`[Pipeline] Staging endpoint: ${stagingInfo?.name || CONFIG.endpointStaging}`)

  const imageTag = await deployStaging()
  await promoteToProd(imageTag)

  console.log('[Pipeline] Success: promoted staging image to production')
}

main().catch((err) => {
  console.error('[Pipeline] Failed:', err)
  process.exit(1)
})
