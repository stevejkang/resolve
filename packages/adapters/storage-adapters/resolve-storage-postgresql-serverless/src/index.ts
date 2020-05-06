import RDSDataService from 'aws-sdk/clients/rdsdataservice'
import _createAdapter from 'resolve-storage-base'

import loadEventsByCursor from './js/load-events-by-cursor'
import loadEventsByTimestamp from './js/load-events-by-timestamp'
import freeze from './js/freeze'
import unfreeze from './js/unfreeze'
import getLatestEvent from './js/get-latest-event'
import saveEvent from './js/save-event'
import fullJitter from './js/full-jitter'
import executeStatement from './js/execute-statement'
import saveEventOnly from './js/save-event-only'
import paginateEvents from './js/paginate-events'
import coercer from './js/coercer'
import escapeId from './js/escape-id'
import escape from './js/escape'
import shapeEvent from './js/shape-event'

import connect from './connect'
import init from './init'
import drop from './drop'
import dispose from './dispose'
import getSecretsManager from './secrets-manager'

import _createResource from './resource/create'
import _disposeResource from './resource/dispose'
import _destroyResource from './resource/destroy'

import { CloudResource, CloudResourcePool } from './types'

const createAdapter = _createAdapter.bind(null, {
  connect,
  loadEventsByCursor,
  loadEventsByTimestamp,
  getLatestEvent,
  saveEvent,
  init,
  drop,
  dispose,
  freeze,
  unfreeze,
  RDSDataService,
  escapeId,
  escape,
  fullJitter,
  executeStatement,
  saveEventOnly,
  paginateEvents,
  coercer,
  shapeEvent,
  getSecretsManager
})

export default createAdapter

const cloudPool: CloudResourcePool = {
  executeStatement,
  connect,
  RDSDataService,
  escapeId,
  escape,
  fullJitter,
  coercer,
  dispose,
  shapeEvent
}

const createResource = _createResource.bind(null, cloudPool)
const disposeResource = _disposeResource.bind(
  null,
  cloudPool as CloudResourcePool & CloudResource
)
const destroyResource = _destroyResource.bind(null, cloudPool)

Object.assign(cloudPool, {
  createResource,
  disposeResource,
  destroyResource
})

export {
  createResource as create,
  disposeResource as dispose,
  destroyResource as destroy
}
