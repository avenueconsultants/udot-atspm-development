import type { GitHubReleaseDto } from '@/api/config'
import About from '@/pages/about'
import { CONFIG_API } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import { renderWithProviders, screen } from '@/test/test-utils'
import { HttpResponse, http } from 'msw'

const release = (
  tagName: string,
  htmlUrl = `https://github.com/OpenSourceTransportation/Atspm/releases/tag/${tagName}`
): GitHubReleaseDto => ({
  tagName,
  htmlUrl,
})

// Both version endpoints are OData functions returning a single complex
// value, which arrives as the object itself (plus a context link), not in a
// collection envelope. The latest-version path carries its parameter in
// parentheses, which a plain MSW path pattern would read as a regex group,
// hence the RegExp.
const stubVersions = ({
  current,
  latest,
}: {
  current: GitHubReleaseDto | { status: number }
  latest: GitHubReleaseDto | { status: number }
}) => {
  const respond = (body: GitHubReleaseDto | { status: number }) =>
    'status' in body
      ? HttpResponse.json({ title: 'Upstream unavailable' }, body)
      : HttpResponse.json({
          '@odata.context': `${CONFIG_API}/$metadata#GitHubReleaseDto`,
          ...body,
        })

  server.use(
    http.get(`${CONFIG_API}/GetCurrentVersion`, () => respond(current)),
    http.get(/\/GetLatestVersion\(PreRelease=false\)$/, () => respond(latest))
  )
}

describe('About page', () => {
  it('shows an update prompt when the latest release is newer', async () => {
    stubVersions({ current: release('v5.2.0'), latest: release('v5.2.1') })

    renderWithProviders(<About />)

    expect(await screen.findByText('Update available')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'About ATSPM' })
    ).toBeInTheDocument()
    expect(screen.getByText('v5.2.0')).toBeInTheDocument()
    expect(screen.getByText('v5.2.1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view release/i })).toHaveAttribute(
      'href',
      'https://github.com/OpenSourceTransportation/Atspm/releases/tag/v5.2.1'
    )
  })

  it('treats matching versions as up to date after normalizing the tag prefix', async () => {
    stubVersions({ current: release('5.2.1'), latest: release('v5.2.1') })

    renderWithProviders(<About />)

    expect(await screen.findByText('ATSPM is up to date')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /view release/i })
    ).not.toBeInTheDocument()
  })

  // Regression test: this state was unreachable for a 5xx, because the page
  // left the app-wide throwOnError policy in place and the failure went to
  // the error boundary instead. The old hook-mocked test could not see that.
  it('shows an unavailable state when a version endpoint fails', async () => {
    stubVersions({ current: { status: 503 }, latest: release('v5.2.1') })

    renderWithProviders(<About />)

    // The page asks React Query for one retry before giving up, so the error
    // state takes a retry delay to arrive.
    expect(
      await screen.findByText('Version status unavailable', undefined, {
        timeout: 5000,
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.queryByText('ATSPM is up to date')).not.toBeInTheDocument()
  }, 10000)
})
