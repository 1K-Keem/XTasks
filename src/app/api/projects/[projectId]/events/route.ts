import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { canAccessProject } from '../../../../../lib/project-access'
import { subscribeProjectEvents } from '../../../../../lib/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })
  if (!(await canAccessProject(params.projectId, session.user.id))) {
    return new Response('Forbidden', { status: 403 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      send('connected', { ok: true, at: Date.now() })

      const unsubscribe = subscribeProjectEvents(params.projectId, (event) => {
        try {
          send('project_event', event)
        } catch {
          unsubscribe()
        }
      })

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 25000)

      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }

      request.signal.addEventListener('abort', cleanup)
    },
    cancel() {
      // No-op: listener/interval are cleaned up by stream teardown and abort handler.
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
