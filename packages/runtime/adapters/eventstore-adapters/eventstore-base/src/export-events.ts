import { Readable } from 'stream'

import {
  BATCH_SIZE,
  MAINTENANCE_MODE_AUTO,
  MAINTENANCE_MODE_MANUAL,
} from './constants'
import getNextCursor from './get-next-cursor'
import { AlreadyFrozenError, AlreadyUnfrozenError } from './frozen-errors'

import type {
  AdapterBoundPool,
  ExportOptions,
  ExportEventsStream,
  InputCursor,
  StoredEvent,
} from './types'

type Context<ConfiguredProps extends {}> = {
  pool: AdapterBoundPool<ConfiguredProps>
  maintenanceMode: ExportOptions['maintenanceMode']
  cursor: InputCursor
  bufferSize: number
  isBufferOverflow: boolean
  isEnd: boolean
  externalTimeout: boolean
}

const FLUSH_CHUNK_SIZE = 64 * 1024 * 1024

async function startProcessEvents<ConfiguredProps extends {}>({
  pool,
  maintenanceMode,
}: Context<ConfiguredProps>): Promise<void> {
  if (maintenanceMode === MAINTENANCE_MODE_AUTO) {
    try {
      await pool.freeze()
    } catch (error) {
      if (!AlreadyFrozenError.is(error)) {
        throw error
      }
    }
  }
}

async function endProcessEvents<ConfiguredProps extends {}>({
  pool,
  maintenanceMode,
}: Context<ConfiguredProps>): Promise<void> {
  if (maintenanceMode === MAINTENANCE_MODE_AUTO) {
    try {
      await pool.unfreeze()
    } catch (error) {
      if (!AlreadyUnfrozenError.is(error)) {
        throw error
      }
    }
  }
}

type EventRecord = {
  buffer: Buffer
  event: StoredEvent
}

async function* generator<ConfiguredProps extends {}>(
  context: Context<ConfiguredProps>
): AsyncGenerator<Buffer, void> {
  const { pool, bufferSize } = context

  await startProcessEvents(context)

  let eventsByteSize = 0

  while (true) {
    const { events } = await pool.loadEventsByCursor({
      cursor: context.cursor,
      limit: BATCH_SIZE,
    })

    let currentTotalChunkSize = 0
    let eventRecords: EventRecord[] = []

    function* flushEvents() {
      if (eventRecords.length <= 0) {
        return
      }

      yield Buffer.concat(eventRecords.map((record) => record.buffer))
      context.cursor = getNextCursor(
        context.cursor,
        eventRecords.map((record) => record.event)
      )
      eventRecords = []
      currentTotalChunkSize = 0
    }

    for (const event of events) {
      const buffer: Buffer = Buffer.from(JSON.stringify(event) + '\n', 'utf8')

      const byteLength = buffer.byteLength
      if (eventsByteSize + byteLength > bufferSize) {
        yield* flushEvents()

        context.isBufferOverflow = true
        await endProcessEvents(context)
        return
      }
      eventsByteSize += byteLength

      if (currentTotalChunkSize + buffer.byteLength > FLUSH_CHUNK_SIZE) {
        yield* flushEvents()

        if (context.externalTimeout) {
          await endProcessEvents(context)
          return
        }
      }
      eventRecords.push({ buffer, event })
      currentTotalChunkSize += buffer.byteLength
    }

    void (yield* flushEvents())

    if (events.length < BATCH_SIZE) {
      context.isEnd = true
      await endProcessEvents(context)
      return
    } else if (context.externalTimeout) {
      await endProcessEvents(context)
      return
    }
  }
}

const exportEventsStream = <ConfiguredProps extends {}>(
  pool: AdapterBoundPool<ConfiguredProps>,
  {
    cursor = null,
    maintenanceMode = MAINTENANCE_MODE_AUTO,
    bufferSize = Number.POSITIVE_INFINITY,
  }: Partial<ExportOptions> = {}
): ExportEventsStream => {
  if (
    ![MAINTENANCE_MODE_AUTO, MAINTENANCE_MODE_MANUAL].includes(maintenanceMode)
  ) {
    throw new Error(`Wrong maintenance mode ${String(maintenanceMode)}`)
  }

  const context: Context<ConfiguredProps> = {
    pool,
    maintenanceMode,
    cursor,
    bufferSize,
    isBufferOverflow: false,
    isEnd: false,
    externalTimeout: false,
  }

  const stream: ExportEventsStream = Readable.from(
    generator(context)
  ) as ExportEventsStream
  stream.on('timeout', () => {
    context.externalTimeout = true
  })
  Object.defineProperty(stream, 'cursor', {
    get() {
      return context.cursor
    },
  })
  Object.defineProperty(stream, 'isBufferOverflow', {
    get() {
      return context.isBufferOverflow
    },
  })
  Object.defineProperty(stream, 'isEnd', {
    get() {
      return context.isEnd
    },
  })

  return stream
}

export default exportEventsStream
