import Header from '@/components/header'
import { useRuntimeEnv } from '@/contexts/RuntimeEnvContext'
import SM_Map from '@/features/speedManagementTool/components/SM_Map'
import { Box, Typography } from '@mui/material'
import Head from 'next/head'

const SpeedManagementTool = () => {
  const title = 'Speed Management Tool'
  const { SPEED_URL } = useRuntimeEnv()

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <Header title="Speed Management Tool" />
      {SPEED_URL ? (
        <SM_Map />
      ) : (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1">
            The Speed Management Tool is not configured for this environment.
          </Typography>
        </Box>
      )}
    </>
  )
}

export default SpeedManagementTool
