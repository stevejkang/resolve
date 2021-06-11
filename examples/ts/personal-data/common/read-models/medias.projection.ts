import { ReadModel } from '@resolve-js/core'
import { ResolveStore } from '@resolve-js/readmodel-base'
import { MEDIA_UPLOAD_STARTED } from '../media.events'

const readModel: ReadModel<ResolveStore> = {
  Init: async (store) => {
    await store.defineTable('Media', {
      indexes: { id: 'string', mediaId: 'string' },
      fields: ['owner', 'timestamp'],
    })
  },
  [MEDIA_UPLOAD_STARTED]: async (store, event) => {
    const {
      aggregateId,
      timestamp,
      payload: { mediaId, ownerId },
    } = event

    await store.insert('Media', {
      owner: ownerId,
      id: aggregateId,
      timestamp,
      mediaId,
    })
  },
}

export default readModel
