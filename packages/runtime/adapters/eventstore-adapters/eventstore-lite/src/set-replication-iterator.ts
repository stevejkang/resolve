import type { AdapterPool } from './types'
import type { ReplicationState } from '@resolve-js/eventstore-base'
import initReplicationStateTable from './init-replication-state-table'

const setReplicationIterator = async (
  pool: AdapterPool,
  iterator: ReplicationState['iterator']
): Promise<void> => {
  const { executeQuery, escapeId, escape } = pool

  const replicationStateTableName = await initReplicationStateTable(pool)

  await executeQuery(
    `UPDATE ${escapeId(replicationStateTableName)} 
    SET
      "Iterator" = ${escape(
        iterator != null ? JSON.stringify(iterator) : 'null'
      )}`
  )
}

export default setReplicationIterator