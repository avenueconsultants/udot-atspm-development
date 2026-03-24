import {
  GitHubReleaseDto,
  useGetVersionVersionHistoryFromPreRelease,
} from '@/api/config'
import { ResponsivePageLayout } from '@/components/ResponsivePage'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined'
import UpgradeOutlinedIcon from '@mui/icons-material/UpgradeOutlined'
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Fragment, ReactNode, useMemo } from 'react'

const urlPattern = /(https?:\/\/[^\s]+)/g

type ReleaseTier = 'major' | 'minor' | 'patch' | 'other'

type ParsedVersion = {
  major: number
  minor: number
  patch: number
}

type ReleaseWithTier = {
  release: GitHubReleaseDto
  tier: ReleaseTier
}

export default function VersionHistoryPage() {
  const versionHistoryQuery = useGetVersionVersionHistoryFromPreRelease(false)

  const releases = useMemo(() => {
    const data = [...(versionHistoryQuery.data ?? [])].sort(compareReleases)

    return data.map<ReleaseWithTier>((release, index) => ({
      release,
      tier: getReleaseTier(
        parseReleaseVersion(release),
        parseReleaseVersion(data[index + 1])
      ),
    }))
  }, [versionHistoryQuery.data])

  return (
    <ResponsivePageLayout
      title="Version History"
      subtitle="Release notes and changelog"
    >
      <Stack spacing={3}>
        {versionHistoryQuery.isLoading && (
          <Paper sx={{ p: 4 }}>
            <Stack spacing={2} alignItems="center">
              <CircularProgress />
              <Typography color="text.secondary">
                Loading version history...
              </Typography>
            </Stack>
          </Paper>
        )}

        {versionHistoryQuery.error && !versionHistoryQuery.isLoading && (
          <Alert severity="error">
            Unable to load version history right now.
          </Alert>
        )}

        {!versionHistoryQuery.isLoading &&
          !versionHistoryQuery.error &&
          releases.length === 0 && (
            <Alert severity="info">No version history is available.</Alert>
          )}

        <Stack spacing={2.5}>
          {releases.map(({ release, tier }) => (
            <ReleaseCard
              key={release.id ?? getReleaseTitle(release)}
              release={release}
              tier={tier}
            />
          ))}
        </Stack>
      </Stack>
    </ResponsivePageLayout>
  )
}

function ReleaseCard({
  release,
  tier,
}: {
  release: GitHubReleaseDto
  tier: ReleaseTier
}) {
  const theme = useTheme()
  const styles = getTierStyles(theme, tier)
  const publishedDate = formatReleaseDate(release.publishedAt)
  const createdDate = formatReleaseDate(release.createdAt)
  const metaParts = [
    release.author?.login ? `by ${release.author.login}` : null,
    publishedDate ? `Published ${publishedDate}` : null,
    !publishedDate && createdDate ? `Created ${createdDate}` : null,
  ].filter(Boolean)

  return (
    <Paper
      sx={{
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${styles.borderColor}`,
        boxShadow: release.isLatest
          ? `0 18px 40px ${alpha(styles.accentColor, 0.16)}`
          : `0 10px 28px ${alpha(theme.palette.common.black, 0.05)}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          background: styles.railGradient,
        }}
      />

      <Stack
        spacing={2.5}
        sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'flex-start' }}
          gap={2}
        >
          <Stack spacing={1}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.1,
                  py: 0.5,
                  borderRadius: 999,
                  backgroundColor: styles.badgeBackground,
                  color: styles.badgeTextColor,
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  letterSpacing: 0.2,
                }}
              >
                {styles.icon}
                {styles.badgeLabel}
              </Box>
              {release.isLatest && (
                <Chip size="small" color="success" label="Latest" />
              )}
              {release.prerelease && (
                <Chip size="small" color="warning" label="Pre-release" />
              )}
            </Stack>

            <Box>
              <Typography variant={styles.titleVariant} sx={{ mb: 0.5 }}>
                {getReleaseTitle(release)}
              </Typography>
              {metaParts.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {metaParts.join(' • ')}
                </Typography>
              )}
            </Box>
          </Stack>

          {release.htmlUrl && (
            <MuiLink
              href={release.htmlUrl}
              target="_blank"
              rel="noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                whiteSpace: 'nowrap',
                color: styles.linkColor,
              }}
            >
              View release
              <OpenInNewIcon fontSize="inherit" />
            </MuiLink>
          )}
        </Stack>

        <Box
          sx={{
            p: { xs: 1.5, sm: 2 },
            ml: { xs: 0, sm: 1 },
            borderRadius: 2,
            backgroundColor: alpha(theme.palette.background.default, 0.72),
            border: `1px solid ${alpha(styles.borderColor, 0.35)}`,
          }}
        >
          <ReleaseNotes body={release.body} />
        </Box>
      </Stack>
    </Paper>
  )
}

function ReleaseNotes({ body }: { body?: string | null }) {
  if (!body?.trim()) {
    return (
      <Typography variant="body2" color="text.secondary">
        No release notes provided.
      </Typography>
    )
  }

  return (
    <Stack spacing={1}>
      {body.split(/\r?\n/).map((line, index) => {
        const trimmedLine = line.trim()
        const normalizedLine = normalizeMarkdown(trimmedLine)

        if (!trimmedLine) {
          return <Box key={`space-${index}`} sx={{ height: 4 }} />
        }

        if (trimmedLine.startsWith('## ')) {
          return (
            <Typography key={`heading-${index}`} variant="subtitle1">
              {trimmedLine.slice(3)}
            </Typography>
          )
        }

        if (trimmedLine.startsWith('* ')) {
          return (
            <Box
              key={`bullet-${index}`}
              sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
            >
              <Typography color="text.secondary">•</Typography>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {renderTextWithLinks(normalizeMarkdown(trimmedLine.slice(2)))}
              </Typography>
            </Box>
          )
        }

        if (normalizedLine.startsWith('Full Changelog:')) {
          return (
            <Typography key={`changelog-${index}`} variant="body2">
              {renderTextWithLinks(normalizedLine)}
            </Typography>
          )
        }

        return (
          <Typography key={`line-${index}`} variant="body2">
            {renderTextWithLinks(normalizedLine)}
          </Typography>
        )
      })}
    </Stack>
  )
}

function renderTextWithLinks(text: string) {
  return text.split(urlPattern).map((part, index) => {
    if (!part) {
      return null
    }

    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <MuiLink
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
        >
          {part}
        </MuiLink>
      )
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

function parseReleaseVersion(release?: GitHubReleaseDto): ParsedVersion | null {
  if (!release) {
    return null
  }

  const rawVersion = getReleaseTitle(release)
  const versionMatch = rawVersion.match(/(\d+)\.(\d+)\.(\d+)/)

  if (!versionMatch) {
    return null
  }

  return {
    major: Number(versionMatch[1]),
    minor: Number(versionMatch[2]),
    patch: Number(versionMatch[3]),
  }
}

function compareReleases(left: GitHubReleaseDto, right: GitHubReleaseDto) {
  const leftVersion = parseReleaseVersion(left)
  const rightVersion = parseReleaseVersion(right)

  if (leftVersion && rightVersion) {
    if (leftVersion.major !== rightVersion.major) {
      return rightVersion.major - leftVersion.major
    }

    if (leftVersion.minor !== rightVersion.minor) {
      return rightVersion.minor - leftVersion.minor
    }

    if (leftVersion.patch !== rightVersion.patch) {
      return rightVersion.patch - leftVersion.patch
    }
  }

  if (left.isLatest !== right.isLatest) {
    return Number(right.isLatest) - Number(left.isLatest)
  }

  return getReleaseTitle(right).localeCompare(getReleaseTitle(left))
}

function getReleaseTier(
  version: ParsedVersion | null,
  previousVersion: ParsedVersion | null
): ReleaseTier {
  if (!version) {
    return 'other'
  }

  if (!previousVersion) {
    if (version.patch > 0) {
      return 'patch'
    }

    if (version.minor > 0) {
      return 'minor'
    }

    return 'major'
  }

  if (version.major !== previousVersion.major) {
    return 'major'
  }

  if (version.minor !== previousVersion.minor) {
    return 'minor'
  }

  if (version.patch !== previousVersion.patch) {
    return 'patch'
  }

  return 'other'
}

function getReleaseTitle(release: GitHubReleaseDto) {
  return release.name ?? release.tagName ?? 'Unnamed release'
}

function normalizeMarkdown(text: string) {
  return text.replace(/\*\*/g, '')
}

function formatReleaseDate(value?: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function getTierStyles(
  theme: ReturnType<typeof useTheme>,
  tier: ReleaseTier
): {
  accentColor: string
  borderColor: string
  badgeBackground: string
  badgeLabel: string
  badgeTextColor: string
  icon: ReactNode
  linkColor: string
  railGradient: string
  titleVariant: 'h4' | 'h5' | 'h6'
} {
  switch (tier) {
    case 'major':
      return {
        accentColor: theme.palette.error.main,
        borderColor: alpha(theme.palette.error.main, 0.28),
        badgeBackground: alpha(theme.palette.error.main, 0.12),
        badgeLabel: 'Major release',
        badgeTextColor: theme.palette.error.dark,
        icon: <UpgradeOutlinedIcon fontSize="inherit" />,
        linkColor: theme.palette.error.dark,
        railGradient: `linear-gradient(180deg, ${theme.palette.error.light} 0%, ${theme.palette.error.main} 100%)`,
        titleVariant: 'h4',
      }
    case 'minor':
      return {
        accentColor: theme.palette.info.main,
        borderColor: alpha(theme.palette.info.main, 0.22),
        badgeBackground: alpha(theme.palette.info.main, 0.12),
        badgeLabel: 'Minor release',
        badgeTextColor: theme.palette.info.dark,
        icon: <TipsAndUpdatesOutlinedIcon fontSize="inherit" />,
        linkColor: theme.palette.info.dark,
        railGradient: `linear-gradient(180deg, ${theme.palette.info.light} 0%, ${theme.palette.info.main} 100%)`,
        titleVariant: 'h5',
      }
    case 'patch':
      return {
        accentColor: theme.palette.grey[700],
        borderColor: alpha(theme.palette.grey[600], 0.18),
        badgeBackground: alpha(theme.palette.grey[700], 0.08),
        badgeLabel: 'Patch release',
        badgeTextColor: theme.palette.text.secondary,
        icon: <WorkspacesOutlinedIcon fontSize="inherit" />,
        linkColor: theme.palette.text.primary,
        railGradient: `linear-gradient(180deg, ${theme.palette.grey[400]} 0%, ${theme.palette.grey[700]} 100%)`,
        titleVariant: 'h6',
      }
    default:
      return {
        accentColor: theme.palette.warning.main,
        borderColor: alpha(theme.palette.warning.main, 0.22),
        badgeBackground: alpha(theme.palette.warning.main, 0.12),
        badgeLabel: 'Release',
        badgeTextColor: theme.palette.warning.dark,
        icon: <WorkspacesOutlinedIcon fontSize="inherit" />,
        linkColor: theme.palette.warning.dark,
        railGradient: `linear-gradient(180deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.main} 100%)`,
        titleVariant: 'h6',
      }
  }
}
