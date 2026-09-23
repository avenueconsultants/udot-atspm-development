import type { DetectorComment } from '@/api/config'
import { CONFIG_API, odataCollection } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/test/test-utils'
import { http, HttpResponse } from 'msw'
import { NavigationProvider } from './CellNavigation'
import CommentCell from './CommentCell'

const mockNotify = jest.fn()
jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: mockNotify }),
}))

const existingComment: DetectorComment = {
  id: 20,
  detectorId: 5,
  comment: 'Original comment',
  timeStamp: '2026-03-01T00:00:00Z',
}

const renderComments = () =>
  renderWithProviders(
    <NavigationProvider>
      <table>
        <tbody>
          <tr>
            <CommentCell
              approachId={1}
              detector={{ id: 5, detectionTypes: [] }}
              row={0}
              col={0}
              rowCount={1}
              colCount={1}
            />
          </tr>
        </tbody>
      </table>
    </NavigationProvider>
  )

describe('detector comment mutations', () => {
  beforeEach(() => mockNotify.mockClear())

  it.each(['create', 'edit'] as const)(
    'preserves a failed %s draft and refreshes the comments after retry',
    async (operation) => {
      const user = userEvent.setup()
      let comments = operation === 'create' ? [] : [existingComment]
      const writes: unknown[] = []
      let finishFirstRequest!: () => void
      const firstRequest = new Promise<void>((resolve) => {
        finishFirstRequest = resolve
      })
      const mutationHandler = operation === 'create' ? http.post : http.patch
      const mutationUrl = `${CONFIG_API}/DetectorComment${operation === 'create' ? '' : '/20'}`
      server.use(
        http.get(`${CONFIG_API}/DetectorComment`, () =>
          HttpResponse.json(odataCollection('DetectorComment', comments))
        ),
        mutationHandler(mutationUrl, async ({ request }) => {
          const body = (await request.json()) as DetectorComment
          writes.push(body)
          if (writes.length === 1) {
            await firstRequest
            return HttpResponse.json(
              { title: 'Unavailable', detail: 'Please try again shortly.' },
              { status: 503 }
            )
          }
          const saved = { ...existingComment, ...body }
          comments = [saved]
          return HttpResponse.json(saved, {
            status: operation === 'create' ? 201 : 200,
          })
        })
      )

      renderComments()
      await user.click(screen.getByRole('button', { name: 'View comments' }))
      await user.click(
        await screen.findByRole('button', {
          name: operation === 'create' ? 'Add New' : 'Edit comment',
        })
      )
      const draft = 'Detector needs maintenance'
      const editor = screen.getByRole('textbox', { name: 'Comment' })
      await user.clear(editor)
      await user.type(editor, draft)

      try {
        await user.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => expect(writes).toHaveLength(1))
        expect(editor).toHaveValue(draft)
        expect(editor).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
        expect(mockNotify).not.toHaveBeenCalled()
      } finally {
        finishFirstRequest()
      }

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({
          type: 'error',
          title: 'Error saving comment',
          message: 'Please try again shortly.',
        })
      )
      expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveValue(
        draft
      )
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
      )
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText(draft)).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(writes).toHaveLength(2)
      expect(writes[1]).toEqual(
        operation === 'create'
          ? { comment: draft, detectorId: 5, timeStamp: expect.any(String) }
          : { comment: draft }
      )
      expect(mockNotify).toHaveBeenLastCalledWith({
        type: 'success',
        title: 'Comment saved',
      })
      await user.click(screen.getByRole('button', { name: 'Add New' }))
      expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveValue('')
    }
  )

  it('keeps a failed deletion open for retry and refreshes after success', async () => {
    const user = userEvent.setup()
    let comments = [existingComment]
    let deletes = 0
    server.use(
      http.get(`${CONFIG_API}/DetectorComment`, () =>
        HttpResponse.json(odataCollection('DetectorComment', comments))
      ),
      http.delete(`${CONFIG_API}/DetectorComment/20`, () => {
        if (++deletes === 1) {
          return HttpResponse.json({ title: 'Unavailable' }, { status: 503 })
        }
        comments = []
        return new HttpResponse(null, { status: 204 })
      })
    )

    renderComments()
    await user.click(screen.getByRole('button', { name: 'View comments' }))
    await user.click(
      await screen.findByRole('button', { name: 'Delete comment' })
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith({
        type: 'error',
        title: 'Error deleting comment',
        message: 'Unavailable',
      })
    )
    expect(
      screen.getByText('Are you sure you want to delete this comment?')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('No comments')).toBeInTheDocument()
    expect(
      screen.queryByText('Are you sure you want to delete this comment?')
    ).not.toBeInTheDocument()
    expect(deletes).toBe(2)
    expect(mockNotify).toHaveBeenLastCalledWith({
      type: 'success',
      title: 'Comment deleted',
    })
  })
})
